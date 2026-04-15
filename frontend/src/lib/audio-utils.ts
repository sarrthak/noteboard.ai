/**
 * Audio utility functions for converting and processing audio blobs
 */

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

/**
 * Converts an audio blob to WAV format using the Web Audio API
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } finally {
    await audioContext.close().catch(() => {});
  }
}

/**
 * Converts an AudioBuffer to a WAV Blob
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // Interleave channels if stereo
  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    interleaved = interleaveChannels(left, right);
  } else {
    interleaved = audioBuffer.getChannelData(0);
  }

  // Create the WAV file
  const dataLength = interleaved.length * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // Write WAV header
  writeWavHeader(view, {
    numChannels,
    sampleRate,
    bitDepth,
    dataLength,
    format,
  });

  // Write audio data
  floatTo16BitPCM(view, 44, interleaved);

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Interleaves two audio channels (stereo)
 */
function interleaveChannels(
  left: Float32Array,
  right: Float32Array
): Float32Array {
  const length = left.length + right.length;
  const result = new Float32Array(length);

  let inputIndex = 0;
  for (let outputIndex = 0; outputIndex < length; ) {
    result[outputIndex++] = left[inputIndex];
    result[outputIndex++] = right[inputIndex];
    inputIndex++;
  }

  return result;
}

interface WavHeaderParams {
  numChannels: number;
  sampleRate: number;
  bitDepth: number;
  dataLength: number;
  format: number;
}

/**
 * Writes the WAV file header
 */
function writeWavHeader(view: DataView, params: WavHeaderParams): void {
  const { numChannels, sampleRate, bitDepth, dataLength, format } = params;
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true); // File size - 8
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true); // Subchunk2Size
}

/**
 * Writes a string to a DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts Float32Array audio data to 16-bit PCM
 */
function floatTo16BitPCM(
  view: DataView,
  offset: number,
  input: Float32Array
): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

/**
 * Creates FormData with a WAV file from an audio blob
 */
export async function createAudioFormData(
  audioBlob: Blob,
  fieldName: string = "audio",
  metadata?: Record<string, string>
): Promise<FormData> {
  const formData = new FormData();

  const appendMetadata = () => {
    if (!metadata) return;
    for (const [key, value] of Object.entries(metadata)) {
      if (value && value.trim()) {
        formData.append(key, value);
      }
    }
  };

  try {
    const wavBlob = await convertToWav(audioBlob);
    formData.append(fieldName, wavBlob, "recording.wav");
  } catch (error) {
    // Some browsers cannot decode certain recorded containers/codecs; upload original audio instead.
    console.warn("WAV conversion failed, uploading original audio blob", error);
    const extension = extensionFromMimeType(audioBlob.type);
    const fallbackBlob = audioBlob.type ? audioBlob : new Blob([audioBlob], { type: "audio/webm" });
    formData.append(fieldName, fallbackBlob, `recording.${extension}`);
  }

  appendMetadata();

  return formData;
}
