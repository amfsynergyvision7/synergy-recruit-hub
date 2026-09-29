import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, ImageOff, Trash2, FolderSync, Users2 } from "lucide-react";
import { ThemePicker } from "@/components/ThemePicker";
import type { ColorThemeId } from "@/lib/color-themes";

export const Route = createFileRoute("/_app/settings")({ component: Page });

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_STORAGE_PATH = "company-logo";

function Page() {
  const { profile, role, refresh } = useAuth();
  const { logoUrl, defaultColorTheme, refresh: refreshBranding } = useBranding();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    department: profile?.department ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("app_settings")
      .select("resume_import_folder_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setDriveFolderUrl(data?.resume_import_folder_url ?? ""));
  }, [role]);

  const saveDriveFolder = async () => {
    setSavingFolder(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ resume_import_folder_url: driveFolderUrl.trim() || null, updated_by: profile?.id })
      .eq("id", 1);
    setSavingFolder(false);
    if (error) return toast.error(error.message);
    toast.success("Resume import folder saved");
  };

  const save = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); refresh();
  };

  const uploadLogo = async (file: File) => {
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      return toast.error("Please upload a PNG, JPG, WEBP, or SVG image.");
    }
    if (file.size > MAX_LOGO_BYTES) {
      return toast.error("Logo must be smaller than 2MB.");
    }
    setUploading(true);
    // Same object path every time (upsert) so old versions don't pile up in
    // the bucket; the `?v=` cache-buster on the stored URL is what makes a
    // replaced logo show up immediately instead of serving a cached image.
    const { error: uploadError } = await supabase.storage
      .from("branding")
      .upload(LOGO_STORAGE_PATH, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setUploading(false);
      return toast.error(uploadError.message);
    }
    const { data } = supabase.storage.from("branding").getPublicUrl(LOGO_STORAGE_PATH);
    const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: dbError } = await supabase
      .from("app_settings")
      .update({ logo_url: versionedUrl, updated_by: profile?.id })
      .eq("id", 1);
    setUploading(false);
    if (dbError) return toast.error(dbError.message);
    toast.success("Logo updated");
    refreshBranding();
  };

  const setOrgDefaultTheme = async (id: ColorThemeId) => {
    const { error } = await supabase
      .from("app_settings")
      .update({ default_color_theme: id, updated_by: profile?.id })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Organization default theme updated");
    refreshBranding();
  };

  const removeLogo = async () => {
    setUploading(true);
    await supabase.storage.from("branding").remove([LOGO_STORAGE_PATH]);
    const { error } = await supabase
      .from("app_settings")
      .update({ logo_url: null, updated_by: profile?.id })
      .eq("id", 1);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Logo removed — showing the default mark again");
    refreshBranding();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile.</p>
      </div>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})}/></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
          <div className="space-y-2"><Label>Department</Label><Input value={form.department ?? ""} onChange={(e)=>setForm({...form,department:e.target.value})}/></div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Pick a color theme for your own view — it also changes the mandala mark in the sidebar, the top-right watermark, and the sign-in screen.
            {role === "admin" && " As an admin, you can also set which one new/signed-out visitors see by default."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker
            isAdmin={role === "admin"}
            orgDefault={defaultColorTheme}
            onSetOrgDefault={role === "admin" ? setOrgDefaultTheme : undefined}
          />
        </CardContent>
      </Card>
      {role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Upload your company logo. It appears next to the AMF Synergy Vision mark in the sidebar and on the sign-in page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Current logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm">{logoUrl ? "Custom logo active" : "No logo uploaded yet — showing the default mark"}</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or SVG · up to 2MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_LOGO_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button variant="ghost" disabled={uploading} onClick={removeLogo}>
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Resume Import Folder</CardTitle>
            <CardDescription>
              Paste the link to one shared Google Drive folder — set it to "Anyone with the link — Viewer". Drop new resumes into that same folder, then use "Check Google Drive for new resumes" on the Candidates page to pull them in automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Drive folder URL</Label>
              <Input
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </div>
            <Button disabled={savingFolder} onClick={saveDriveFolder}>
              <FolderSync className="h-4 w-4 mr-2" />{savingFolder ? "Saving…" : "Save folder"}
            </Button>
          </CardContent>
        </Card>
      )}
      {role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Data</CardTitle>
            <CardDescription>Bulk-upload Clients, Jobs, Candidates, Submissions, Interviews, Offers, and Billing from Excel or CSV.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/import"><Upload className="h-4 w-4 mr-2"/>Open Import Tool</Link></Button>
          </CardContent>
        </Card>
      )}
      {role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Duplicate Candidates</CardTitle>
            <CardDescription>Scan every candidate already in the CRM for likely duplicates (same email, phone, or name entered more than once from different sources) and review them side by side to merge or delete.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/duplicates"><Users2 className="h-4 w-4 mr-2"/>Open Duplicate Cleanup</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}