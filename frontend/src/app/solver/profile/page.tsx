"use client";

/**
 * Solver Profile Page — Edit bio and skills.
 *
 * PDF SPEC: Solver can update their profile (bio + skills list).
 * Buyers can see solver profiles when reviewing bids.
 *
 * FEATURES:
 * - Bio textarea (free-form text about the solver)
 * - Skills as comma-separated input → stored as string array
 * - Save button with loading state
 * - Success/error toast feedback
 *
 * DATA FLOW:
 * useMyProfile()        → GET /api/users/me/profile → pre-fill form
 * useUpdateProfile()    → PATCH /api/users/me/profile { bio, skills }
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMyProfile, useUpdateProfile } from "@/hooks/use-solver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { UserCircle, Save, AlertCircle } from "lucide-react";

export default function SolverProfilePage() {
  const { data: profile, isLoading, isError, refetch } = useMyProfile();
  const updateProfile = useUpdateProfile();

  // Form state — initialized from profile data when it loads
  const [bio, setBio] = useState("");
  const [skillsInput, setSkillsInput] = useState("");

  // Pre-fill form when profile data loads
  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      // Convert skills array back to comma-separated string for editing
      setSkillsInput(profile.skills?.join(", ") || "");
    }
  }, [profile]);

  /**
   * Save profile changes.
   * Converts comma-separated skills string → array of trimmed strings.
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse skills: split by comma, trim whitespace, remove empties
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      await updateProfile.mutateAsync({
        bio: bio.trim() || null,
        skills,
      });
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold">Failed to load profile</h3>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCircle className="h-6 w-6" />
          My Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          Update your bio and skills. Buyers see this when reviewing your bids.
        </p>
      </div>

      {/* Profile info card (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Avatar circle */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
              {profile?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
              {profile?.role}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Editable profile form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell buyers about yourself, your experience, and what kind of projects you enjoy..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                A good bio helps buyers trust you with their projects.
              </p>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                placeholder="e.g., Python, React, PostgreSQL, Docker"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list. These help buyers find the right solver for their project.
              </p>
              {/* Preview parsed skills as badges */}
              {skillsInput && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skillsInput
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                    .map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Save button — tap micro-interaction */}
            <div className="flex justify-end">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="gap-2"
                >
                  {updateProfile.isPending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
