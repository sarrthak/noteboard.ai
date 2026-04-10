import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

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

export { handler as GET, handler as POST };
