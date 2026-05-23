import { supabase } from "@/integrations/supabase/client";

export async function uploadQuestionImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("question-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getSignedImageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
