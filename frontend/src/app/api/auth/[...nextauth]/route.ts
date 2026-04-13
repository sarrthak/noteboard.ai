import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function isSessionTokenCookie(setCookie: string): boolean {
  return SESSION_COOKIE_NAMES.some((name) => setCookie.startsWith(`${name}=`));
}

function isCookieDeletion(setCookie: string): boolean {
  return /(?:^|;)\s*Max-Age=0(?:;|$)/i.test(setCookie);
}

function toSessionCookie(setCookie: string): string {
  // Keep explicit sign-out/deletion cookies intact.
  if (!isSessionTokenCookie(setCookie) || isCookieDeletion(setCookie)) {
    return setCookie;
  }

  // Remove persistence directives so the cookie is browser-session scoped.
  return setCookie
    .replace(/;\s*Expires=[^;]*/gi, "")
    .replace(/;\s*Max-Age=[^;]*/gi, "");
}

function makeSessionScopedCookies(response: Response): Response {
  const getSetCookie = (response.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;

  if (!getSetCookie) {
    return response;
  }

  const cookies = getSetCookie.call(response.headers);
  if (cookies.length === 0) {
    return response;
  }

  const rewrittenCookies = cookies.map(toSessionCookie);
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of rewrittenCookies) {
    headers.append("set-cookie", cookie);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const { SERVER_API_BASE_URL } = await import("@/lib/api");
          const apiUrl = SERVER_API_BASE_URL;
          
          // FastAPI OAuth2 expects form-data with 'username' field (not 'email')
          const formData = new URLSearchParams();
          formData.append("username", credentials.email);
          formData.append("password", credentials.password);

          const response = await axios.post(
            `${apiUrl}/auth/login`,
            formData.toString(),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          if (response.data?.access_token) {
            return {
              id: credentials.email,
              email: credentials.email,
              accessToken: response.data.access_token,
            };
          }

          return null;
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist the access token from the user object to the JWT
      if (user?.accessToken) {
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      // Persist the access token from JWT to the session for client access
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export async function GET(request: Request, context: { params: { nextauth: string[] } }) {
  const response = await handler(request, context);
  return makeSessionScopedCookies(response);
}

export async function POST(request: Request, context: { params: { nextauth: string[] } }) {
  const response = await handler(request, context);
  return makeSessionScopedCookies(response);
}
