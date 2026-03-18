"use client";

import { useEffect, useState, useRef } from "react";
import {
  getImages,
  uploadImage,
  updateImage,
  deleteImage,
  type ClinicImage,
} from "@/lib/admin-api";

const IMAGE_TYPES = ["hero", "logo", "gallery", "rooms"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export default function ClinicImagesPage() {
  const [images, setImages] = useState<ClinicImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<ImageType>("gallery");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await getImages();
      setImages(data);
    } catch {
      // handled by adminFetch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("type", selectedType);
        fd.append("alt_text", "");
        await uploadImage(fd);
      }
      await load();
    } catch {
      alert("Upload failed.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleAltTextChange = async (id: string, alt_text: string) => {
    try {
      await updateImage(id, { alt_text });
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, alt_text } : img)));
    } catch {
      // silently fail
    }
  };

  const handleOrderChange = async (id: string, display_order: number) => {
    try {
      await updateImage(id, { display_order });
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, display_order } : img))
      );
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch {
      alert("Failed to delete image.");
    }
  };

  const grouped = IMAGE_TYPES.map((type) => ({
    type,
    items: images
      .filter((img) => img.type === type)
      .sort((a, b) => a.display_order - b.display_order),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-slate mb-6">Image Gallery</h1>

      {/* Upload zone */}
      <div className="bg-white rounded-md border border-cream2 p-6 mb-8">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-sans text-slate">Upload to:</label>
          <div className="flex gap-2">
            {IMAGE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium capitalize transition-colors ${
                  selectedType === t
                    ? "bg-forest text-white"
                    : "bg-cream text-muted hover:bg-cream2"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-forest bg-forest-lt"
              : "border-cream2 hover:border-gold hover:bg-gold-lt/30"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-forest border-t-transparent" />
              <span className="text-sm font-sans text-muted">Uploading...</span>
            </div>
          ) : (
            <>
              <svg
                className="w-10 h-10 text-muted mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm font-sans text-muted">
                Drag and drop images here, or click to browse
              </p>
              <p className="text-xs font-sans text-muted mt-1">PNG, JPG up to 10MB</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Image sections */}
      {grouped.map(({ type, items }) => (
        <div key={type} className="mb-8">
          <h2 className="font-serif text-lg text-slate capitalize mb-3">
            {type}{" "}
            <span className="text-sm font-sans text-muted font-normal">
              ({items.length} image{items.length !== 1 ? "s" : ""})
            </span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-white rounded-md border border-cream2 p-6 text-center text-sm font-sans text-muted">
              No {type} images uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((img) => (
                <div
                  key={img.id}
                  className="bg-white rounded-md border border-cream2 overflow-hidden"
                >
                  <div className="aspect-video bg-cream2 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.alt_text || "Clinic image"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <input
                      type="text"
                      value={img.alt_text}
                      onChange={(e) =>
                        setImages((prev) =>
                          prev.map((i) =>
                            i.id === img.id ? { ...i, alt_text: e.target.value } : i
                          )
                        )
                      }
                      onBlur={(e) => handleAltTextChange(img.id, e.target.value)}
                      placeholder="Alt text..."
                      className="w-full px-2 py-1.5 rounded border border-cream2 text-xs font-sans text-slate focus:outline-none focus:ring-1 focus:ring-forest/30"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-sans text-muted">Order:</label>
                        <input
                          type="number"
                          min={0}
                          value={img.display_order}
                          onChange={(e) =>
                            setImages((prev) =>
                              prev.map((i) =>
                                i.id === img.id
                                  ? { ...i, display_order: parseInt(e.target.value) || 0 }
                                  : i
                              )
                            )
                          }
                          onBlur={(e) =>
                            handleOrderChange(img.id, parseInt(e.target.value) || 0)
                          }
                          className="w-14 px-2 py-1 rounded border border-cream2 text-xs font-sans text-slate focus:outline-none focus:ring-1 focus:ring-forest/30"
                        />
                      </div>
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete image"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
