// src/app/candidate/resume-builder/page.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import {
  FileText,
  Download,
  Eye,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Upload,
  X,
  Mic,
  BookOpen,
  FolderGit2,
  Palette,
  StopCircle,
  UploadCloud,
  Copy,
  Trash2,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List as ListIcon,
   ListOrdered as ListOrderedIcon,
  Link as LinkIcon,
  Unlink as UnlinkIcon
} from 'lucide-react';

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";








import CandidateLayout from '@/components/layout/CandidateLayout';

/* ============================
   Types
============================= */
export interface PersonalInfo { name: string; email: string; phone: string; location: string; legalStatus: string; linkedin?: string; }
export interface ExperienceEntry { id: string; jobTitle: string; company: string; dates: string; description: string; }
export interface EducationEntry { id: string; degree: string; institution: string; graduationYear: string; gpa: string; achievements: string; }
export interface SkillCategory { id: string; category: string; skills_list: string; }
export interface CertificationEntry { id: string; name: string; issuer: string; date: string; }
export interface PublicationEntry { id: string; title: string; authors: string; journal: string; date: string; link: string; }
export interface ProjectEntry { id: string; title: string; date: string; description: string; }
export interface ResumeData {
  personal: PersonalInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillCategory[];
  certifications: CertificationEntry[];
  publications: PublicationEntry[];
  projects: ProjectEntry[];
}
type EnhancementContext =
  | { section: 'summary' }
  | { section: 'experience'; index: number }
  | { section: 'education'; index: number }
  | { section: 'projects'; index: number }
  | { section: 'skills'; index: number }
  | { section: 'pitch' };

export interface StyleOptions { fontFamily: string; fontSize: number; accentColor: string; }


/* ============================
   UI Primitives
============================= */
const Card = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="glass" {...props}>{children}</div>);
const CardHeader = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6" {...props}>{children}</div>);
const CardTitle = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (<h3 className="text-xl font-semibold text-white" {...props}>{children}</h3>);
const CardContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6 pt-0" {...props}>{children}</div>);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive'; size?: 'default' | 'sm'; as?: React.ElementType }
>(({ children, variant, size, className = '', as: Component = 'button', ...props }, ref) => {
  const baseStyle =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantStyles = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-gray-300 text-white bg-transparent hover:bg-white/10 hover:border-white/20',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizeStyles = { default: 'h-10 py-2 px-4', sm: 'h-9 px-3' };
  return (
    <Component
      ref={ref}
      className={`${baseStyle} ${variantStyles[variant || 'default']} ${sizeStyles[size || 'default']} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
});
Button.displayName = 'Button';

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />
);
const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
    {children}
  </select>
);
const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props} className="text-sm font-medium leading-none block mb-1 text-gray-200" />
);
const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className="flex min-h-[80px] w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />
);

/* ============================
   Utilities
============================= */
function unescapeHtml(html: string) {
  if (typeof document === 'undefined' || !html) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.documentElement.textContent || html;
}
/* --- normalize AI enhancement output into plain versions (no "Version 1" etc.) --- */
const stripVersionHeader = (s: string) =>
  s.replace(/^\s*(?:\*{0,2}|_)?version\s*\d+\s*:?\s*(?:\*{0,2}|_)?/i, '').trim();

const normalizeToPureVersions = (raw: unknown): string[] => {
  if (!raw) return [];

  // 1) coerce to a single string
  let text = Array.isArray(raw) ? (raw as string[]).join('\n\n') : String(raw || '');

  // 2) remove backticks/formatting
  text = text.replace(/`{1,3}/g, '').replace(/\r/g, '');

  // 3) split on "Version N:" style headings (markdown or plain)
  let parts = text
    .split(/(?:^|\n)\s*(?:\*{0,2}|_)?version\s*\d+\s*:?\s*(?:\*{0,2}|_)?\s*/gi)
    .map(stripVersionHeader)
    .map(s => s.trim())
    .filter(Boolean);

  // fallback if API already returned an array
  if (!parts.length && Array.isArray(raw)) {
    parts = (raw as string[])
      .map(String)
      .map(stripVersionHeader)
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 4) keep real paragraphs only, drop short “titles”
  parts = parts.filter(p => p.replace(/\s+/g, ' ').length > 80);

  // 5) dedupe & cap
  return Array.from(new Set(parts)).slice(0, 5);
};
/* ============================
   Tiptap Editor
============================= */




export const TiptapEditor: React.FC<{
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = "Write something…", className = "" }) => {
  const isProgrammatic = React.useRef(false);

  const editor = useEditor(
    {
      extensions: [
        // Disable list parts in StarterKit so we add explicit ones
        StarterKit.configure({ bulletList: false, orderedList: false, listItem: false }),
        ListItem,
        BulletList,
        OrderedList,
        Placeholder.configure({ placeholder }),
        Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      ],
      content: value || "<p></p>",
      onUpdate: ({ editor }) => {
        if (isProgrammatic.current) return;
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class:
            "tiptap min-h-[140px] p-3 rounded-b-md border-x border-b border-white/20 bg-white/10 text-white focus:outline-none",
        },
      },
      injectCSS: false,
      immediatelyRender: false,
    },
    [] // do NOT depend on `value` — prevents remount/caret jump
  );

  // keep editor in sync when parent value changes (without firing onUpdate)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML() || "";
    const next = value || "<p></p>";
    if (current !== next) {
      isProgrammatic.current = true;
      editor.commands.setContent(next, { emitUpdate: false });
      isProgrammatic.current = false;
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[140px] p-3 rounded-md border border-white/20 bg-white/10 text-white">
        Loading editor…
      </div>
    );
  }

  // Button that preserves selection (so list toggles work)
  const ToolbarButton = ({
    title,
    active,
    onAction,
    children,
  }: {
    title: string;
    active?: boolean;
    onAction: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep selection; don't move focus away
        onAction();
      }}
      className={`px-2 py-1 rounded hover:bg-white/10 ${active ? "bg-white/20" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div className={`tiptap-editor ${className}`}>
      {/* compact icon toolbar */}
      <div className="flex items-center gap-1 rounded-t-md border border-white/20 bg-white/10 text-white px-2 py-1">
        <ToolbarButton
          title="Bold (Ctrl+B)"
          active={editor.isActive("bold")}
          onAction={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon size={18} />
        </ToolbarButton>

        <ToolbarButton
          title="Italic (Ctrl+I)"
          active={editor.isActive("italic")}
          onAction={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon size={18} />
        </ToolbarButton>

        <div className="mx-1 opacity-30">|</div>

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onAction={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon size={18} />
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onAction={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon size={18} />
        </ToolbarButton>

        <div className="mx-1 opacity-30">|</div>

        <ToolbarButton
          title="Add link"
          active={editor.isActive("link")}
          onAction={() => {
            const prev = editor.getAttributes("link")?.href || "";
            const url = window.prompt("Enter URL", prev || "https://");
            if (!url) return;
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <LinkIcon size={18} />
        </ToolbarButton>

        <ToolbarButton
          title="Remove link"
          onAction={() => editor.chain().focus().unsetLink().run()}
        >
          <UnlinkIcon size={18} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};
/* ============================
   Small Forms & Modals
============================= */

const SummaryForm = ({ value, onChange, onEnhance, loading }: any) => (
  <div>
    <Label>Professional Summary</Label>
    <TiptapEditor
      value={value || ''}
      onChange={onChange}
      placeholder="A concise summary of your professional experience and goals..."
    />
    <Button size="sm" variant="outline" className="mt-2" onClick={onEnhance} disabled={loading}>
      <Sparkles size={14} className="mr-1.5" />
      Enhance
    </Button>
  </div>
);

const DynamicSection = ({ sectionKey, data, onChange, onAdd, onRemove, onEnhance, fields, addPayload, loading }: any) => (
  <div className="space-y-4">
    {(data || []).map((item: any, index: number) => (
      <div key={item.id} className="p-4 border border-white/20 rounded-lg relative space-y-3">
        <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => onRemove(sectionKey, item.id)}>
          <Trash2 size={14} />
        </Button>
        <div className="grid md:grid-cols-2 gap-4">
          {fields.map((field: any) => {
            const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
            let InputComponent: any;
            let inputProps: any = {
              value: item[field.key] || '',
              onChange: (e: any) => onChange(sectionKey, index, field.key, e.target.value),
              placeholder: `Enter ${field.label.toLowerCase()}...`,
            };

            if (field.type === 'textarea' || field.type === 'quill') {
              InputComponent = TiptapEditor;
              inputProps.onChange = (val: string) => onChange(sectionKey, index, field.key, val);
              inputProps.value = item[field.key] || '';
            } else if (field.type === 'plain_textarea') {
              InputComponent = Textarea;
              inputProps.onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(sectionKey, index, field.key, e.target.value);
              inputProps.rows = 5;
              inputProps.placeholder = `Enter ${field.label.toLowerCase()}...`;
            } else {
              InputComponent = Input;
            }

            return (
              <div key={field.key} className={colSpanClass}>
                <Label>{field.label}</Label>
                <InputComponent {...inputProps} />
                {field.enhance && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => onEnhance({ section: sectionKey, index })} disabled={loading}>
                    <Sparkles size={14} className="mr-1.5" />
                    Enhance
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ))}
    <Button variant="outline" onClick={() => onAdd(sectionKey, addPayload)}>
      + Add {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
    </Button>
  </div>
);

const DesignForm = ({ options, onChange }: { options: StyleOptions; onChange: (field: keyof StyleOptions, value: any) => void }) => {
  const fontFamilies = ['Calibri, sans-serif', 'Georgia, serif', 'Helvetica, sans-serif', 'Verdana, sans-serif', 'Garamond, serif'];
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="font-family">Font Family</Label>
        <Select id="font-family" value={options.fontFamily} onChange={(e) => onChange('fontFamily', e.target.value)}>
          {fontFamilies.map((font) => (
            <option key={font} value={font}>
              {font.split(',')[0]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="font-size">Font Size (pt)</Label>
        <Input id="font-size" type="number" value={options.fontSize} onChange={(e) => onChange('fontSize', parseInt(e.target.value, 10))} />
      </div>
      <div>
        <Label htmlFor="accent-color">Accent Color</Label>
        <div className="flex items-center gap-2">
          <Input id="accent-color" type="color" value={options.accentColor} onChange={(e) => onChange('accentColor', e.target.value)} className="p-1 h-10 w-14" />
          <Input type="text" value={options.accentColor} onChange={(e) => onChange('accentColor', e.target.value)} className="flex-1" />
        </div>
      </div>
    </div>
  );
};

const EnhancementModal = ({
  isOpen,
  versions = [],
  selected,
  onSelect,
  onApply,
  onClose,
  originalText,
}: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl text-white border border-white/10">
        <div className="flex justify-between items-center p-4">
          <h3 className="text-xl font-bold">Choose an Enhanced Version</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-4 pb-4">
          {Array.isArray(versions) && versions.length > 0 ? (
            versions.map((version: string, index: number) => (
              <label
                key={index}
                className="block p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
              >
                <input
                  type="radio"
                  name="enhancementVersion"
                  className="mr-3"
                  checked={selected === version}
                  onChange={() => onSelect(version)}
                />
                <div
                  className="text-sm text-gray-200 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html:
                      version === originalText
                        ? `<strong>(Original)</strong> ${version}`
                        : version,
                  }}
                />
              </label>
            ))
          ) : (
            <div className="text-sm text-gray-400 p-3">Generating suggestions…</div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-white/10">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onApply} disabled={!selected}>Apply Selection</Button>
        </div>
      </div>
    </div>
  );
};




type PitchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pitchText: string;
  setPitchText: (v: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  recordedVideoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onVideoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  loading: boolean;
  videoBlob: Blob | null;
  onEnhance?: () => void; // ← new
};

const PitchModal = ({
  isOpen,
  onClose,
  pitchText,
  setPitchText,
  startRecording,
  stopRecording,
  isRecording,
  recordedVideoUrl,
  videoRef,
  onVideoFileChange,
  onUpload,
  loading,
  videoBlob,
  onEnhance, // ← new
}: PitchModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-4xl text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Your Elevator Pitch</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Script */}
          <div>
            <h4 className="font-semibold mb-2">AI-Generated Script</h4>
            <Textarea
              value={pitchText}
              onChange={(e) => setPitchText(e.target.value)}
              rows={12}
              className="bg-white/10 w-full"
            />

            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(pitchText);
                  toast.success('Copied to clipboard!');
                }}
                className="flex items-center gap-2"
              >
                <Copy size={14} />
                Copy Script
              </Button>

              {/* Enhance button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEnhance && onEnhance()}
                disabled={!onEnhance || !pitchText?.trim() || loading}
                className="flex items-center gap-2"
                title="Get AI suggestions for this pitch"
              >
                <Sparkles size={14} />
                Enhance
              </Button>
            </div>
          </div>

          {/* Right: Video */}
          <div>
            <h4 className="font-semibold mb-2">Record or Upload Video</h4>
            <div className="bg-black rounded-lg aspect-video mb-2 flex items-center justify-center">
              <video
                ref={videoRef}
                src={!isRecording && recordedVideoUrl ? recordedVideoUrl : undefined}
                controls={!!recordedVideoUrl && !isRecording}
                autoPlay={isRecording}
                muted={isRecording}
                playsInline
                className="w-full h-full rounded-lg object-contain bg-black"
              />
            </div>

            <div className="flex justify-center items-center gap-4">
              {isRecording ? (
                <Button onClick={stopRecording} variant="destructive">
                  <StopCircle size={16} className="mr-2" />
                  Stop
                </Button>
              ) : (
                <Button onClick={startRecording}>
                  <Mic size={16} className="mr-2" />
                  Record
                </Button>
              )}

              <Label htmlFor="video-upload" className="cursor-pointer m-0">
                <Button as="span" variant="outline">
                  <UploadCloud size={16} className="mr-2" />
                  Upload File
                </Button>
              </Label>
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onVideoFileChange}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onUpload} disabled={!videoBlob || loading}>
            {loading ? (
              'Uploading...'
            ) : (
              <>
                <Upload size={16} className="mr-2" /> Upload Pitch
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ============================
   Minimal PersonalForm
============================= */
const PersonalForm = ({
  data,
  onChange,
  onPicChange,
  onPicRemove,
  picPreview,
  inputRef, // NEW
}: {
  data: PersonalInfo;
  onChange: (field: keyof PersonalInfo, value: string) => void;
  onPicChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPicRemove: () => void;
  picPreview?: string | null;                       // (optional) allow null too
  inputRef: React.RefObject<HTMLInputElement | null>; // ⬅️ allow null here
}) => {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input value={data.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Your full name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={data.email} onChange={(e) => onChange('email', e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={data.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="+1 555 000 0000" />
        </div>
        <div>
          <Label>Location</Label>
          <Input value={data.location} onChange={(e) => onChange('location', e.target.value)} placeholder="City, State" />
        </div>
        {/* LinkedIn (NEW) */}
        <div>
          <Label>LinkedIn URL</Label>
          <Input
            value={data.linkedin || ''}
            onChange={(e) => onChange('linkedin', e.target.value)}
            placeholder="https://www.linkedin.com/in/your-handle"
          />
        </div>


    


        <div className="md:col-span-2">
          <Label>Visa Status</Label>

          {(() => {
            const baseOptions = [
              'Prefer not to say',
              'US Citizen',
              'Green Card',
              'H-1B',
              'L-1',
              'TN',
              'F-1',
              'F-1 Initial OPT',
              'F-1 STEM OPT',
              'CPT',
              'H-4 EAD',
              'EAD',
              'Other',
            ];

            const currentVal = (data?.legalStatus || 'Prefer not to say').trim();
            const hasCurrent = baseOptions.some((o) => o.toLowerCase() === currentVal.toLowerCase());
            const options = hasCurrent ? baseOptions : [currentVal, ...baseOptions];

            return (



              <Select
                value={currentVal}
                onChange={(e) => onChange('legalStatus', e.target.value)}
                className="
                  w-full
                  rounded-md
                  border border-gray-300 bg-gray-100 text-gray-900
                  dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100
                  px-3 py-2
                "
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>

            );
          })()}
        </div>
        
      </div>

      {/* Profile Picture */}
      <div>
        <Label>Profile Picture</Label>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}              // was: profilePicInputRef
            type="file"
            accept="image/*"
            onChange={onPicChange}      // was: handleProfilePicChange
              className="
                block w-full text-sm cursor-pointer
                file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-2
                file:bg-gray-700 file:text-white file:cursor-pointer
                hover:file:bg-gray-600
                dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700
                focus:outline-none focus:ring-2 focus:ring-indigo-500/40
              "
          />

          {picPreview && (              // was: profilePic.preview
            <>
              <img
                src={picPreview}
                alt="Preview"
                className="h-12 w-12 object-cover rounded-full border border-white/20"
              />
              <Button variant="destructive" size="sm" onClick={onPicRemove}>
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================
   Page Component
============================= */
export default function ResumeBuilder() {


  const [activeSection, setActiveSection] = useState<string>('personal');

  const [resumeData, setResumeDataState] = useState<ResumeData>({
    personal: { name: '', email: '', phone: '', location: '', legalStatus: 'Prefer not to say',linkedin: '' },
    summary: '<p></p>',
    experience: [{ id: crypto.randomUUID(), jobTitle: '', company: '', dates: '', description: '<p></p>' }],
    education: [{ id: crypto.randomUUID(), degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }],
    skills: [{ id: crypto.randomUUID(), category: '', skills_list: '' }],
    certifications: [{ id: crypto.randomUUID(), name: '', issuer: '', date: '' }],
    publications: [{ id: crypto.randomUUID(), title: '', authors: '', journal: '', date: '', link: '' }],
    projects: [{ id: crypto.randomUUID(), title: '', date: '', description: '<p></p>' }],
  });

  

 

  const setResumeData: React.Dispatch<React.SetStateAction<ResumeData>> = (updater) => {
  setResumeDataState(prev =>
    typeof updater === 'function'
      ? (updater as (p: ResumeData) => ResumeData)(prev)
      : updater
  );
};


  const [loading, setLoading] = useState<boolean>(false);
  // --- Profile picture state & refs ---
  type ProfilePicState = {
    file: File | null;
    preview: string | null;   // data-url or object url for preview
    objectUrl: string | null; // track to revoke when removed/replaced
  };

  const [profilePic, setProfilePic] = useState<ProfilePicState>({
    file: null,
    preview: null,
    objectUrl: null,
  });

  const profilePicInputRef = useRef<HTMLInputElement | null>(null);

  // Revoke object URL when it changes / on unmount
  useEffect(() => {
    return () => {
      if (profilePic.objectUrl) URL.revokeObjectURL(profilePic.objectUrl);
    };
  }, [profilePic.objectUrl]);

  const [showPamtenLogo, setShowPamtenLogo] = useState<boolean>(false);
  const [showEnhancementModal, setShowEnhancementModal] = useState<boolean>(false);
  const [enhancementVersions, setEnhancementVersions] = useState<string[]>([]);
  const [selectedEnhancement, setSelectedEnhancement] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [enhancementContext, setEnhancementContext] = useState<EnhancementContext | null>(null);
  const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
  const [pitchText, setPitchText] = useState('');
  const [styleOptions, setStyleOptions] = useState<StyleOptions>({ fontFamily: 'Calibri, sans-serif', fontSize: 11, accentColor: '#34495e' });
  const [panelWidth, setPanelWidth] = useState(50);
  const isResizing = useRef(false);
  const API_BASE_URL: string = `${process.env.NEXT_PUBLIC_API_BASE}/api`;
  console.log("API_BASE_URL in frontend:", API_BASE_URL);
  // === Enhance Elevator Pitch (AI) ===
const handleEnhancePitch = async () => {
  const source = (pitchText || '').trim();
  if (!source) {
    toast.message('Nothing to enhance in the pitch yet.');
    return;
  }

  // prime modal state
  setOriginalText(source);
  setEnhancementContext({ section: 'pitch' } as any);
  setSelectedEnhancement('');
  setEnhancementVersions([]);
  setShowEnhancementModal(true);

  setLoading(true);
  try {
    const resp = await fetch(`${API_BASE_URL}/enhance-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionName: 'pitch',
        textToEnhance: source,
      }),
    });

    const data = await resp.json();

    // ---- normalize + clean suggestions (no "Version 1:", no one-liners) ----
    let raw: string[] = [];
    if (Array.isArray(data?.enhancedVersions)) raw = data.enhancedVersions;
    else if (typeof data?.enhancedVersions === 'string')
      raw = data.enhancedVersions.split(/\n{2,}|^[-*_]{3,}\s*$/m).filter(Boolean);

    const cleaned = (raw || [])
      .map(s => s ?? '')
      .map(s =>
        s
          .replace(/^`+|`+$/g, '')                                 // strip backticks/code fences
          .replace(/^#{1,6}\s+/gm, '')                             // strip markdown headings
          .replace(/^\s*[-•*\d.)]+\s+/gm, '')                      // strip bullets/numbered prefixes
          .replace(/^(\*\*?)?\s*version\s*\d+\s*[:\-\.]?\s*\**/i, '') // drop "Version 1:"
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(Boolean);

    // keep only substantial, unique paragraphs (no tiny titles)
    const MIN_LEN = 120;
    const suggestions = Array.from(new Set(cleaned)).filter(s => s.length >= MIN_LEN).slice(0, 5);

    if (suggestions.length) {
      // show ONLY the 5 versions (no extra "Version 1" boxes, no original entry)
      setEnhancementVersions(suggestions);
      setSelectedEnhancement(''); // let user pick
      setShowEnhancementModal(true);
      toast.success('AI suggestions ready!');
    } else {
      toast.error('Could not generate suggestions.');
      setShowEnhancementModal(false);
    }
  } catch (e) {
    console.error(e);
    toast.error('Failed to enhance the pitch.');
    setShowEnhancementModal(false);
  } finally {
    setLoading(false);
  }
};




  const applySelectedEnhancement = React.useCallback(() => {
  if (!selectedEnhancement || !enhancementContext) return;

  switch (enhancementContext.section) {
    case 'summary':
      setResumeData(prev => ({ ...prev, summary: selectedEnhancement }));
      break;

    case 'experience': {
      const idx = enhancementContext.index;
      setResumeData(prev => ({
        ...prev,
        experience: prev.experience.map((e, i) =>
          i === idx ? { ...e, description: selectedEnhancement } : e
        ),
      }));
      break;
    }

    case 'education': {
      const idx = enhancementContext.index;
      setResumeData(prev => ({
        ...prev,
        education: prev.education.map((e, i) =>
          i === idx ? { ...e, achievements: selectedEnhancement } : e
        ),
      }));
      break;
    }

    case 'projects': {
      const idx = enhancementContext.index;
      setResumeData(prev => ({
        ...prev,
        projects: prev.projects.map((p, i) =>
          i === idx ? { ...p, description: selectedEnhancement } : p
        ),
      }));
      break;
    }

    case 'skills': {
      const idx = enhancementContext.index;
      setResumeData(prev => ({
        ...prev,
        skills: prev.skills.map((s, i) =>
          i === idx ? { ...s, skills_list: selectedEnhancement } : s
        ),
      }));
      break;
    }

    case 'pitch':
      setPitchText(selectedEnhancement);
      break;
  }

  // clear & close chooser
  setEnhancementVersions([]);
  setSelectedEnhancement('');
  setEnhancementContext(null as any);
  setShowEnhancementModal?.(false);
}, [
  selectedEnhancement,
  enhancementContext,
  setResumeData,
  setPitchText,
  setEnhancementVersions,
  setSelectedEnhancement,
]);


  // ===== File upload UI state (show filename even after parsing) =====
const [resumeFile, setResumeFile] = useState<File | null>(null);
const [uploadedName, setUploadedName] = useState<string>("");
const fileInputRef = useRef<HTMLInputElement>(null);

const onResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0] || null;
  setResumeFile(f);
  setUploadedName(f ? f.name : "");
};




  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const handlePersonalChange = (field: keyof PersonalInfo, value: string) => {
    setResumeData((prev: ResumeData) => ({ ...prev, personal: { ...prev.personal, [field]: value } }));
  };
  const handleSummaryChange = (value: string) => {
    setResumeData((prev: ResumeData) => ({ ...prev, summary: value }));
  };
  const handleDynamicChange = <
    T extends ExperienceEntry | EducationEntry | SkillCategory | CertificationEntry | PublicationEntry | ProjectEntry
  >(
    section: keyof ResumeData,
    index: number,
    field: keyof T,
    value: any
  ) => {
    setResumeData((prev: ResumeData) => {
      const newList = [...(prev[section] as T[])];
      newList[index] = { ...newList[index], [field]: value } as T;
      return { ...prev, [section]: newList };
    });
  };



  const handleParseResume = async () => {
    if (!resumeFile) {
      toast.error("Choose a resume file first");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", resumeFile);

    try {
      const resp = await fetch(`${API_BASE_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Server responded with an error");
      }

      const result = await resp.json();

      // Normalize everything
      const normalized: ResumeData = normalizeResumeData(result.parsedData || {});
      setResumeData(normalized);

      // 🔽🔽🔽 CLEAR PROFILE PICTURE WHEN A NEW RESUME IS PARSED
      if (profilePic?.objectUrl) URL.revokeObjectURL(profilePic.objectUrl);
      setProfilePic({ file: null, preview: null, objectUrl: null });
      if (profilePicInputRef.current) profilePicInputRef.current.value = "";
      // 🔼🔼🔼

      toast.success("Resume parsed successfully!");

      // Allow choosing the same resume file again
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      console.error("parse-resume failed:", e);
      toast.error(e.message || "Failed to parse resume");
    } finally {
      setLoading(false);
    }
  };


















  // Keep this near your other handlers in page.tsx

  const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Revoke any previous object URL to avoid leaks
    if (profilePic.objectUrl) {
      URL.revokeObjectURL(profilePic.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);

    setProfilePic({
      file,
      preview: objectUrl,   // use as <img src={profilePic.preview} />
      objectUrl,            // track so we can revoke later
    });

    toast.success('Profile picture selected.');
  };

  const handleProfilePicRemove = () => {
    // Revoke current object URL (if any)
    if (profilePic.objectUrl) {
      URL.revokeObjectURL(profilePic.objectUrl);
    }

    // Clear state
    setProfilePic({ file: null, preview: null, objectUrl: null });

    // IMPORTANT: also clear the input value so the same file can be chosen again
    if (profilePicInputRef.current) {
      profilePicInputRef.current.value = '';
    }

    toast.info('Profile picture removed.');
  };

  const handleStyleChange = (field: keyof StyleOptions, value: any) => {
    setStyleOptions((prev) => ({ ...prev, [field]: value }));
  };

  const addDynamicEntry = (section: keyof ResumeData, newEntry: any) =>
    setResumeData((prev: ResumeData) => ({ ...prev, [section]: [...(prev[section] as any[]), { ...newEntry, id: crypto.randomUUID() }] }));
  const removeDynamicEntry = (section: keyof ResumeData, id: string) =>
    setResumeData((prev: ResumeData) => ({ ...prev, [section]: (prev[section] as any[]).filter((item) => item.id !== id) }));

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };
  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
  }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 25 && newWidth < 75) setPanelWidth(newWidth);
  }, []);
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);





  // --- Visa Status options + normalizer ----------------------------------------
  const VISA_OPTIONS = [
    'Prefer not to say',
    'US Citizen',
    'Green Card',
    'H-1B',
    'L-1',
    'TN',
    'F-1',
    'F-1 Initial OPT',
    'F-1 STEM OPT',
    'CPT',
    'H-4 EAD',
    'EAD',
    'Other',
  ];

  // small helper to update a personal field
  const updatePersonalField = (key: keyof ResumeData['personal'], value: string) => {
    setResumeData((d) => ({
      ...d,
      personal: { ...d.personal, [key]: value },
    }));
  };

  // Normalize arbitrary strings to EXACT Select values above
  const normalizeLegalStatus = (raw: any): string => {
    const s = (raw ?? '').toString().trim();
    if (!s) return 'Prefer not to say';

    // strip leading labels like "Visa Status:" / "Work Authorization:"
    const clean = s.replace(/^\s*(visa\s*status|work\s*authorization)\s*:\s*/i, '').trim();

    // exact (case-insensitive) match first
    const exact = VISA_OPTIONS.find((o) => o.toLowerCase() === clean.toLowerCase());
    if (exact) return exact;

    // heuristics → map to your Select values
    const t = clean.toLowerCase().replace(/\./g, ''); // ignore dots (US vs U.S.)
    if (/\b(us|united states)\s*citizen\b/.test(t) || /^citizen$/.test(t)) return 'US Citizen';
    if (/green\s*card|permanent\s*resident|lawful\s*permanent/.test(t)) return 'Green Card';
    if (/h[\s-]?1b/.test(t)) return 'H-1B';
    if (/l[\s-]?1/.test(t)) return 'L-1';
    if (/\btn\b/.test(t)) return 'TN';
    if (/^f[\s-]?1$/.test(t)) return 'F-1';
    if (/f[\s-]?1.*initial.*opt/.test(t) || /initial.*opt/.test(t)) return 'F-1 Initial OPT';
    if (/f[\s-]?1.*stem.*opt/.test(t) || /stem.*opt/.test(t)) return 'F-1 STEM OPT';
    if (/\bcpt\b/.test(t)) return 'CPT';
    if (/h[\s-]?4.*ead/.test(t)) return 'H-4 EAD';
    if (/\bead\b/.test(t)) return 'EAD';

    // last resort
    return 'Other';
  };

  // --- Main normalizer ----------------------------------------------------------
  const normalizeResumeData = (data: any): ResumeData => {
    const defaultHtmlValue = '<p></p>';
    const defaultPlainValue = '';
    const normalized: any = { ...data };

    // Ensure arrays exist
    normalized.experience     = Array.isArray(normalized.experience) ? normalized.experience : [];
    normalized.education      = Array.isArray(normalized.education) ? normalized.education : [];
    normalized.skills         = Array.isArray(normalized.skills) ? normalized.skills : [];
    normalized.certifications = Array.isArray(normalized.certifications) ? normalized.certifications : [];
    normalized.publications   = Array.isArray(normalized.publications) ? normalized.publications : [];
    normalized.projects       = Array.isArray(normalized.projects) ? normalized.projects : [];

    // Personal (label cleanup + mapping to dropdown options)
    const rawPersonal = normalized.personal ?? {};
    const rawLinkedIn = typeof rawPersonal?.linkedin === 'string' ? rawPersonal.linkedin : '';
    const cleanedLinkedIn = rawLinkedIn.replace(/^\s*linkedin\s*:\s*/i, '').trim();

    normalized.personal = {
      name:     typeof rawPersonal?.name === 'string' ? rawPersonal.name : '',
      email:    typeof rawPersonal?.email === 'string' ? rawPersonal.email : '',
      phone:    typeof rawPersonal?.phone === 'string' ? rawPersonal.phone : '',
      location: typeof rawPersonal?.location === 'string' ? rawPersonal.location : '',
      legalStatus: normalizeLegalStatus(
        rawPersonal?.legalStatus ??
        rawPersonal?.visaStatus ??
        rawPersonal?.workAuthorization ??
        ''
      ),
      linkedin: cleanedLinkedIn,
    };

    // Summary (rich text)
    normalized.summary =
      typeof normalized.summary === 'string'
        ? (unescapeHtml(normalized.summary) || defaultHtmlValue)
        : defaultHtmlValue;

    // Experience
    normalized.experience = normalized.experience.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      jobTitle: typeof item?.jobTitle === 'string' ? item.jobTitle : '',
      company: typeof item?.company === 'string' ? item.company : '',
      dates: typeof item?.dates === 'string' ? item.dates : '',
      description:
        typeof item?.description === 'string'
          ? (unescapeHtml(item.description) || defaultHtmlValue)
          : defaultHtmlValue,
    }));

    // Education
    normalized.education = normalized.education.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      degree: typeof item?.degree === 'string' ? item.degree : '',
      institution: typeof item?.institution === 'string' ? item.institution : '',
      graduationYear: typeof item?.graduationYear === 'string' ? item.graduationYear : '',
      gpa: typeof item?.gpa === 'string' ? item.gpa : '',
      achievements:
        typeof item?.achievements === 'string'
          ? (unescapeHtml(item.achievements) || defaultHtmlValue)
          : defaultHtmlValue,
    }));

    // Skills
    normalized.skills = normalized.skills.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      category: typeof item?.category === 'string' ? item.category : '',
      skills_list: typeof item?.skills_list === 'string' ? (item.skills_list || defaultPlainValue) : defaultPlainValue,
    }));

    // Projects
    normalized.projects = normalized.projects.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      title: typeof item?.title === 'string' ? item.title : '',
      date: typeof item?.date === 'string' ? item.date : '',
      description:
        typeof item?.description === 'string'
          ? (unescapeHtml(item.description) || defaultHtmlValue)
          : defaultHtmlValue,
    }));

    // Publications
    normalized.publications = normalized.publications.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      title: typeof item?.title === 'string' ? item.title : '',
      authors: typeof item?.authors === 'string' ? item.authors : '',
      journal: typeof item?.journal === 'string' ? item.journal : '',
      date: typeof item?.date === 'string' ? item.date : '',
      link: typeof item?.link === 'string' ? item.link : '',
    }));

    // Certifications
    normalized.certifications = normalized.certifications.map((item: any) => ({
      id: item?.id || crypto.randomUUID(),
      name: typeof item?.name === 'string' ? item.name : '',
      issuer: typeof item?.issuer === 'string' ? item.issuer : '',
      date: typeof item?.date === 'string' ? item.date : '',
    }));

    return normalized as ResumeData;
  };









  const handleEnhance = async (context: EnhancementContext) => {
    let textToEnhance = '';
    let sectionNameForApi = '';
    if (context.section === 'summary') { textToEnhance = resumeData.summary; sectionNameForApi = 'Summary'; }
    else if (context.section === 'experience') { textToEnhance = resumeData.experience[context.index].description; sectionNameForApi = 'Experience Description'; }
    else if (context.section === 'education') { textToEnhance = resumeData.education[context.index].achievements; sectionNameForApi = 'Education Achievements'; }
    else if (context.section === 'projects') { textToEnhance = resumeData.projects[context.index].description; sectionNameForApi = 'Project Description'; }
    else if (context.section === 'skills') { textToEnhance = resumeData.skills[context.index].skills_list; sectionNameForApi = 'Skills'; }

    let contentForCheck = textToEnhance;
    if (context.section !== 'skills') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = textToEnhance;
      contentForCheck = tempDiv.textContent || '';
    }
    if (!contentForCheck.trim()) {
      toast.info('Field is empty, nothing to enhance.');
      return;
    }

    setEnhancementContext(context);
    setOriginalText(textToEnhance);
    setLoading(true);
    toast.info(`Enhancing ${sectionNameForApi}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/enhance-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionName: sectionNameForApi, textToEnhance }),
      });
      if (!response.ok) throw new Error('Enhancement failed');
      const result = await response.json();
      if (Array.isArray(result.enhancedVersions) && result.enhancedVersions.length > 0) {
        const processed = result.enhancedVersions.map((v: string) => (context.section === 'skills' ? v : unescapeHtml(v)));
        setEnhancementVersions([textToEnhance, ...processed]);
        setSelectedEnhancement(context.section === 'skills' ? textToEnhance : unescapeHtml(textToEnhance));
        setShowEnhancementModal(true);
        toast.success('AI suggestions ready!');
      } else {
        toast.info('No new suggestions were generated.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyEnhancement = () => {
    if (!enhancementContext) return;
    const { section } = enhancementContext;

    if (section === 'summary') {
      handleSummaryChange(selectedEnhancement);
    } else if ('index' in enhancementContext) {
      if (section === 'experience')
        handleDynamicChange('experience', enhancementContext.index, 'description' as keyof ExperienceEntry, selectedEnhancement);
      else if (section === 'education')
        handleDynamicChange('education', enhancementContext.index, 'achievements' as keyof EducationEntry, selectedEnhancement);
      else if (section === 'projects')
        handleDynamicChange('projects', enhancementContext.index, 'description' as keyof ProjectEntry, selectedEnhancement);
      else if (section === 'skills')
        handleDynamicChange('skills', enhancementContext.index, 'skills_list' as keyof SkillCategory, selectedEnhancement);
    }

    setShowEnhancementModal(false);
    toast.success('Section updated!');
  };

  /* ===== Elevator Pitch ===== */
  const stripHtml = (html: string) =>
    (html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const compactResumeForPitch = (data: ResumeData) => {
    const personal = data.personal || {};
    const summary = stripHtml(data.summary || '');

    const exp = (data.experience || [])
      .filter((e) => (e.jobTitle || e.company || e.description)?.trim())
      .map((e) => ({
        jobTitle: e.jobTitle || '',
        company: e.company || '',
        dates: e.dates || '',
        description: stripHtml(e.description || ''),
      }));

    const edu = (data.education || [])
      .filter((e) => (e.degree || e.institution || e.achievements)?.trim())
      .map((e) => ({
        degree: e.degree || '',
        institution: e.institution || '',
        graduationYear: e.graduationYear || '',
        gpa: e.gpa || '',
        achievements: stripHtml(e.achievements || ''),
      }));

    const skills = (data.skills || [])
      .filter((s) => (s.category || s.skills_list)?.trim())
      .map((s) => ({
        category: s.category || '',
        skills: s.skills_list || '',
      }));

    const projects = (data.projects || [])
      .filter((p) => (p.title || p.description)?.trim())
      .map((p) => ({
        title: p.title || '',
        date: p.date || '',
        description: stripHtml(p.description || ''),
      }));

    return {
      personal: {
        name: personal.name || '',
        email: personal.email || '',
        phone: personal.phone || '',
        location: personal.location || '',
      },
      summary,
      experience: exp,
      education: edu,
      skills,
      projects,
    };
  };

  const buildLocalPitch = (d: ReturnType<typeof compactResumeForPitch>) => {
    const name = d.personal.name || 'This candidate';
    const headline =
      d.summary ||
      (d.experience[0]?.jobTitle ? `${name.split(' ')[0]} is a ${d.experience[0].jobTitle}.` : `${name.split(' ')[0]} is a motivated professional.`);

    const keySkills = d.skills
      .map((s) => s.skills)
      .join(', ')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');

    const win = d.experience.find((e) => e.description)?.description.split('\n')[0] || '';
    const goal = 'looking to contribute on high-impact teams and deliver measurable results.';

    return [headline, keySkills ? `Key skills include ${keySkills}.` : '', win ? `Notably, ${win}.` : '', `Currently ${goal}`].filter(Boolean).join(' ');
  };

  const handleGeneratePitch = async () => {
    const compact = compactResumeForPitch(resumeData);
    const hasSignal =
      compact.summary ||
      compact.experience.length ||
      compact.education.length ||
      compact.skills.length ||
      compact.projects.length;

    if (!hasSignal) {
      toast.info('Add some resume details first, then generate a pitch.');
      setPitchText('Please add some resume details (summary, experience, skills, etc.) and try again.');
      setShowPitchModal(true);
      return;
    }

    setShowPitchModal(true);
    setPitchText('Generating your elevator pitch from the resume…');
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/generate-elevator-pitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: compact }),
      });

      if (!resp.ok) {
        const local = buildLocalPitch(compact);
        setPitchText(local);
        toast.warning('Used local pitch fallback (API error).');
        return;
      }

      const data = await resp.json();
      const serverPitch = (data?.elevatorPitch || '').trim();
      const looksGeneric = !serverPitch || /please provide|i need the resume details|give me the information/i.test(serverPitch);
      if (looksGeneric) {
        const local = buildLocalPitch(compact);
        setPitchText(local);
        toast.warning('Used local pitch fallback (server returned a generic prompt).');
      } else {
        setPitchText(serverPitch);
        toast.success('Elevator pitch generated!');
      }
    } catch (err: any) {
      const local = buildLocalPitch(compact);
      setPitchText(local);
      toast.warning('Used local pitch fallback (network error).');
    } finally {
      setLoading(false);
    }
  };

  /* ===== Video Record/Upload ===== */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (videoRef.current) {
        // Live preview
        (videoRef.current as any).srcObject = stream;
        videoRef.current.src = '';
        videoRef.current.muted = true;
        videoRef.current.controls = false;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => {});
      }

      setIsRecording(true);
      setRecordedVideoUrl(null);
      setVideoBlob(null);

      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      let mimeType = '';
      for (const c of candidates) {
        if ((window as any).MediaRecorder?.isTypeSupported?.(c)) {
          mimeType = c;
          break;
        }
      }

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        setVideoBlob(blob);

        if (recordedUrlRef.current) {
          URL.revokeObjectURL(recordedUrlRef.current);
          recordedUrlRef.current = null;
        }

        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedVideoUrl(url);

        // switch to recorded preview
        if (videoRef.current) {
          videoRef.current.pause();
          (videoRef.current as any).srcObject = null;
          videoRef.current.src = url;
          videoRef.current.muted = false;
          videoRef.current.controls = true;
          videoRef.current.playsInline = true;
          videoRef.current.load();
        }

        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
    } catch (err) {
      toast.error('Could not access camera/microphone. Please check permissions.');
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleVideoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoBlob(file);

    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }

    const url = URL.createObjectURL(file);
    recordedUrlRef.current = url;
    setRecordedVideoUrl(url);

    if (videoRef.current) {
      videoRef.current.pause();
      (videoRef.current as any).srcObject = null;
      videoRef.current.src = url;
      videoRef.current.muted = false;
      videoRef.current.controls = true;
      videoRef.current.playsInline = true;
      videoRef.current.load();
    }

    toast.success('Video file selected.');
  };

  const handleUploadPitchVideo = async () => {
    if (!videoBlob) {
      toast.error('No video to upload!');
      return;
    }
    setLoading(true);
    toast.info('Uploading video pitch...', { id: 'upload-pitch' });

    // TODO: integrate real upload
    setTimeout(() => {
      setLoading(false);
      toast.success('Video pitch uploaded! (simulation)', { id: 'upload-pitch' });
    }, 2000);
  };

  const handleClosePitch = () => {
    setShowPitchModal(false);
    const tracks = ((videoRef.current?.srcObject as MediaStream) || null)?.getTracks?.() || [];
    tracks.forEach((t) => t.stop());
    if (videoRef.current) (videoRef.current as any).srcObject = null;
  };

  useEffect(() => {
    if (!isRecording && recordedVideoUrl && videoRef.current) {
      videoRef.current.pause();
      (videoRef.current as any).srcObject = null;
      videoRef.current.src = recordedVideoUrl;
      videoRef.current.muted = false;
      videoRef.current.controls = true;
      videoRef.current.playsInline = true;
      videoRef.current.load();
    }
  }, [recordedVideoUrl, isRecording]);

  useEffect(() => {
    return () => {
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, []);

  /* ===== Upload + Parse Resume ===== */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const toastId = 'upload';
    toast.info('Parsing resume...', { id: toastId });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`${API_BASE_URL}/parse-resume`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Server responded with an error');
      }

      const result = await resp.json();
      const normalizedData = normalizeResumeData(result.parsedData);
      setResumeDataState(normalizedData);

      toast.success('Resume parsed successfully!', { id: toastId });
    } catch (e: any) {
      toast.error(`Failed to parse: ${e.message}`, { id: toastId });
      console.error('Frontend file upload error:', e);
    } finally {
      setLoading(false);
      (event.target as HTMLInputElement).value = '';
    }
  };

  /* ===== Download (PDF/DOCX), incl. base64 images ===== */
  const handleDownload = async (type: 'PDF' | 'DOCX') => {
    const endpoint = type === 'PDF' ? '/generate-pdf' : '/generate-docx';
    const filename = `${resumeData.personal.name.replace(/\s/g, '_')}_Resume.${type.toLowerCase()}`;
    const toastId = `${type.toLowerCase()}-download`;

    toast.info(`Generating ${type} file...`, { id: toastId, duration: 15000 });
    setLoading(true);

    let pamtenLogoBase64: string | null = null;
    if (showPamtenLogo) {
      const logoResp = await fetch('/pamten_logo.png');
      const logoBlob = await logoResp.blob();
      pamtenLogoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
    }

    let profilePicBase64: string | null = null;
    if (profilePic.preview) {
      const picResp = await fetch(profilePic.preview);
      const picBlob = await picResp.blob();
      profilePicBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(picBlob);
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resumeData,
          styleOptions,
          showPamtenLogo,
          pamtenLogoBase64,
          profilePicBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server responded with an error');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${type} downloaded successfully!`, { id: toastId });
    } catch (error: any) {
      toast.error(`Failed to generate ${type}: ${error.message}`, { id: toastId });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
/* ===== Preview Renderer ===== */


  /* ===== Preview Renderer ===== */
  const renderResumePreview = () => {
    const { personal, summary, experience, education, skills, certifications, publications, projects } = resumeData;

    // Build contact line with LinkedIn between location and visa status
    const contactParts: React.ReactNode[] = [];
    if (personal.email) contactParts.push(personal.email);
    if (personal.phone) contactParts.push(personal.phone);
    if (personal.location) contactParts.push(personal.location);

    if (personal.linkedin) {
      const raw = (personal.linkedin || '').trim();
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      // show the actual URL (without the protocol) as the label
      const label = href.replace(/^https?:\/\//i, '');
      contactParts.push(
        <a
          key="linkedin"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all"
        >
          {label}
        </a>
      );
    }


    if (personal.legalStatus && personal.legalStatus !== 'Prefer not to say') {
      contactParts.push(`Visa Status: ${personal.legalStatus}`);
    }

    return (
      <div
        id="resume-preview-content"
        className="bg-white p-8 rounded-lg border border-gray-300 min-h-[600px] quill-content-container text-gray-900"
        style={{
          fontFamily: styleOptions.fontFamily,
          fontSize: `${styleOptions.fontSize}pt`,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {showPamtenLogo && (
          <div className="mb-4">
            <img src="/pamten_logo.png" alt="Pamten Logo" style={{ width: '120px' }} />
          </div>
        )}

        <div className="text-center mb-6 pb-4 border-b border-gray-300 flex items-center justify-between text-gray-900">
          <div>
            <h2 className="text-4xl font-bold" style={{ color: styleOptions.accentColor }}>
              {personal.name || 'Your Name'}
            </h2>
            <p className="text-gray-600 mt-2">
              {contactParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ' | '}
                  {part}
                </React.Fragment>
              ))}
            </p>
          </div>
          {profilePic.preview && (
            <img
              src={profilePic.preview}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
          )}
        </div>

        {(summary || '').trim() && (
          <div key="summary-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Summary
            </h3>
            <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: summary || '' }} />
          </div>
        )}

        {(experience || []).some((e) => (e.jobTitle || '').trim() || (e.description || '').trim()) && (
          <div key="experience-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Experience
            </h3>
            {(experience || []).map((exp) => (
              <div key={exp.id} className="mt-2 text-gray-700">
                <h4>
                  <b>{exp.jobTitle || ''}</b>
                </h4>
                <p className="text-gray-600">
                  {exp.company || ''} | {exp.dates || ''}
                </p>
                <div dangerouslySetInnerHTML={{ __html: exp.description || '' }} />
              </div>
            ))}
          </div>
        )}

        {(education || []).some((e) => (e.degree || '').trim() || (e.achievements || '').trim()) && (
          <div key="education-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Education
            </h3>
            {(education || []).map((edu) => (
              <div key={edu.id} className="mt-2 text-gray-700">
                <h4>
                  <b>{edu.degree || ''}</b>, {edu.institution || ''}
                </h4>
                <p className="text-gray-600">
                  {edu.graduationYear || ''}
                  {edu.gpa && ` | GPA: ${edu.gpa}`}
                </p>
                <div dangerouslySetInnerHTML={{ __html: edu.achievements || '' }} />
              </div>
            ))}
          </div>
        )}

        {(skills || []).some((e) => (e.category || '').trim() || (e.skills_list || '').trim()) && (
          <div key="skills-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Skills
            </h3>
            {(skills || []).map((skill) => (
              <div key={skill.id} className="mt-1 text-gray-700">
                <b>{skill.category || ''}:</b>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    color: 'inherit',
                  }}
                >
                  {skill.skills_list || ''}
                </pre>
              </div>
            ))}
          </div>
        )}

        {(projects || []).some((proj) => (proj.title || '').trim() || (proj.description || '').trim()) && (
          <div key="projects-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Projects
            </h3>
            {(projects || []).map((proj) => (
              <div key={proj.id} className="mt-2 text-gray-700">
                <h4>
                  <b>{proj.title || ''}</b> ({proj.date || ''})
                </h4>
                <div dangerouslySetInnerHTML={{ __html: proj.description || '' }} />
              </div>
            ))}
          </div>
        )}

        {(publications || []).some((e) => (e.title || '').trim()) && (
          <div key="publications-section" className="mb-4">
            <h3
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Publications
            </h3>
            {(publications || []).map((pub) => (
              <div key={pub.id} className="mt-2 text-gray-700">
                <h4>
                  <b>{pub.title || ''}</b> ({pub.date || ''})
                </h4>
                <p className="text-sm text-gray-600">
                  {pub.authors || ''} - <i>{pub.journal || ''}</i>
                </p>
              </div>
            ))}
          </div>
        )}

        {(certifications || []).some((e) => (e.name || '').trim()) && (
          <div>
            <h3
              key="certifications-section"
              className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2"
              style={{ color: styleOptions.accentColor }}
            >
              Certifications
            </h3>
            {(certifications || []).map((cert) => (
              <div key={cert.id} className="mt-2 text-gray-700">
                <h4>
                  <b>{cert.name || ''}</b>
                </h4>
                <p className="text-gray-600">
                  {cert.issuer || ''}
                  {cert.date && ` | ${cert.date}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  

  const sections = [
    { id: 'personal', name: 'Personal', icon: <User size={16} /> },
    { id: 'summary', name: 'Summary', icon: <FileText size={16} /> },
    { id: 'experience', name: 'Experience', icon: <Briefcase size={16} /> },
    { id: 'education', name: 'Education', icon: <GraduationCap size={16} /> },
    { id: 'skills', name: 'Skills', icon: <Award size={16} /> },
    { id: 'projects', name: 'Projects', icon: <FolderGit2 size={16} /> },
    { id: 'publications', name: 'Publications', icon: <BookOpen size={16} /> },
    { id: 'certifications', name: 'Certifications', icon: <Award size={16} /> },
    { id: 'design', name: 'Design', icon: <Palette size={16} /> },
  ];

  return (
    <CandidateLayout>
      <Toaster richColors position="top-right" />




      {/* Enhancement modal – single source of truth */}
      <EnhancementModal
        isOpen={showEnhancementModal}
        versions={enhancementVersions}
        selected={selectedEnhancement}
        onSelect={setSelectedEnhancement}
        originalText={originalText}
        onApply={applySelectedEnhancement}
        onClose={() => {
          setShowEnhancementModal(false);
          setEnhancementVersions([]);
          setSelectedEnhancement('');
          setEnhancementContext(null as any);
        }}
      />




      <PitchModal
        isOpen={showPitchModal}
        onClose={handleClosePitch}
        pitchText={pitchText}
        setPitchText={setPitchText}
        startRecording={startRecording}
        stopRecording={stopRecording}
        isRecording={isRecording}
        recordedVideoUrl={recordedVideoUrl}
        videoRef={videoRef}
        onVideoFileChange={handleVideoFileUpload}
        onUpload={handleUploadPitchVideo}
        loading={loading}
        videoBlob={videoBlob}
        onEnhance={handleEnhancePitch}
      />



      <div className="flex flex-col h-full bg-transparent font-sans">
        <header className="flex-shrink-0 bg-white/5 dark:bg-zinc-900/40 backdrop-blur-md border-b border-white/10 p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/pamten_logo.png" alt="Pamten Logo" className="h-8" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  AI Resume Builder
                </h1>
                <p className="text-xs text-gray-300">Craft your professional resume with AI assistance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleGeneratePitch} disabled={loading} size="sm" variant="outline">
                <Mic size={14} className="mr-1.5" />
                Elevator Pitch
              </Button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 min-h-0">
          {/* Left editor panel */}
          <div className="flex flex-col overflow-y-auto p-6" style={{ width: `${panelWidth}%` }}>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload size={20} />
                    Upload Resume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                                  
                  <div className="space-y-3">
                    {/* Row 1: Choose File + filename pill */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Hidden native input */}
                      <input
                        ref={fileInputRef}
                        id="resumeFile"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        disabled={loading}
                        onChange={onResumeFileChange}
                        className="hidden"
                      />

                      {/* Trigger button */}
                      <label
                        htmlFor="resumeFile"
                        className="inline-flex h-10 items-center rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white hover:bg-white/20 cursor-pointer"
                      >
                        Choose File
                      </label>

                      {/* Filename pill (fallback to 'No file chosen') */}
                      {uploadedName ? (
                        <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-sm text-gray-200">
                          <span className="max-w-[260px] truncate">{uploadedName}</span>
                          <button
                            type="button"
                            className="ml-1 hover:text-red-300"
                            onClick={() => {
                              setResumeFile(null);
                              setUploadedName("");
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            aria-label="Remove file"
                            title="Remove file"
                          >
                            <X size={16} />
                          </button>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No file chosen</span>
                      )}
                    </div>

                    {/* Row 2: Parse button (now under Choose File) */}
                    <Button onClick={handleParseResume} disabled={loading} className="w-fit">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Parse Resume
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <Button
                        key={section.id}
                        variant={activeSection === section.id ? 'default' : 'outline'}
                        onClick={() => setActiveSection(section.id)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {section.icon} {section.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>

                <CardContent>
                  {activeSection === 'personal' && (

                    <PersonalForm
                      data={resumeData.personal}
                      onChange={handlePersonalChange}
                      onPicChange={handleProfilePicChange}
                      onPicRemove={handleProfilePicRemove}
                      picPreview={profilePic.preview ?? undefined}   // ⬅️ fix
                      inputRef={profilePicInputRef}
                    />
                    )}


                  {activeSection === 'summary' && (
                    <SummaryForm
                      value={resumeData.summary}
                      onChange={handleSummaryChange}
                      onEnhance={() => handleEnhance({ section: 'summary' })}
                      loading={loading}
                    />
                  )}

                  {activeSection === 'experience' && (
                    <DynamicSection
                      sectionKey="experience"
                      data={resumeData.experience}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      onEnhance={handleEnhance}
                      loading={loading}
                      addPayload={{ jobTitle: '', company: '', dates: '', description: '<p></p>' }}
                      fields={[
                        { key: 'jobTitle', label: 'Job Title' },
                        { key: 'company', label: 'Company' },
                        { key: 'dates', label: 'Dates' },
                        { key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2 },
                      ]}
                    />
                  )}

                  {activeSection === 'education' && (
                    <DynamicSection
                      sectionKey="education"
                      data={resumeData.education}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      onEnhance={handleEnhance}
                      loading={loading}
                      addPayload={{ degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }}
                      fields={[
                        { key: 'degree', label: 'Degree' },
                        { key: 'institution', label: 'Institution' },
                        { key: 'graduationYear', label: 'Graduation Year' },
                        { key: 'gpa', label: 'GPA (Optional)' },
                        { key: 'achievements', label: 'Achievements & Coursework', type: 'textarea', enhance: true },
                      ]}
                    />
                  )}

                  {activeSection === 'skills' && (
                    <DynamicSection
                      sectionKey="skills"
                      data={resumeData.skills}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      loading={loading}
                      addPayload={{ category: '', skills_list: '' }}
                      fields={[
                        { key: 'category', label: 'Category' },
                        { key: 'skills_list', label: 'Skills (comma-separated)', type: 'plain_textarea', colSpan: 2 },
                      ]}
                    />
                  )}

                  {activeSection === 'projects' && (
                    <DynamicSection
                      sectionKey="projects"
                      data={resumeData.projects}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      onEnhance={handleEnhance}
                      loading={loading}
                      addPayload={{ title: '', date: '', description: '<p></p>' }}
                      fields={[
                        { key: 'title', label: 'Project Title' },
                        { key: 'date', label: 'Date' },
                        { key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2 },
                      ]}
                    />
                  )}

                  {activeSection === 'publications' && (
                    <DynamicSection
                      sectionKey="publications"
                      data={resumeData.publications}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      loading={loading}
                      addPayload={{ title: '', authors: '', journal: '', date: '', link: '' }}
                      fields={[
                        { key: 'title', label: 'Publication Title' },
                        { key: 'authors', label: 'Authors' },
                        { key: 'journal', label: 'Journal or Conference' },
                        { key: 'date', label: 'Publication Date' },
                        { key: 'link', label: 'Link (Optional)' },
                      ]}
                    />
                  )}

                  {activeSection === 'certifications' && (
                    <DynamicSection
                      sectionKey="certifications"
                      data={resumeData.certifications}
                      onChange={handleDynamicChange}
                      onAdd={addDynamicEntry}
                      onRemove={removeDynamicEntry}
                      loading={loading}
                      addPayload={{ name: '', issuer: '', date: '' }}
                      fields={[
                        { key: 'name', label: 'Certification Name' },
                        { key: 'issuer', label: 'Issuing Organization' },
                        { key: 'date', label: 'Date Received' },
                      ]}
                    />
                  )}

                  {activeSection === 'design' && <DesignForm options={styleOptions} onChange={handleStyleChange} />}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Drag handle */}
          <div className="flex-shrink-0 w-2.5 cursor-col-resize bg-gray-200 hover:bg-indigo-200 transition-colors" onMouseDown={handleMouseDown} />

          {/* Right preview panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 min-w-0">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye size={20} />
                  Resume Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">{renderResumePreview()}</CardContent>
            </Card>

            <div className="space-y-4 mt-6 flex-shrink-0">
              <div className="flex items-center space-x-2 p-4 border border-white/20 rounded-lg bg-white/10">
                <input
                  type="checkbox"
                  id="pamtenLogo"
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  checked={showPamtenLogo}
                  onChange={(e) => setShowPamtenLogo(e.target.checked)}
                />
                <label htmlFor="pamtenLogo" className="text-sm font-medium text-gray-300">
                  Add Pamten Logo to Document
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleDownload('PDF')} disabled={loading}>
                  <Download size={16} className="mr-2" />
                  Download PDF
                </Button>

                <Button variant="outline" className="w-full" onClick={() => handleDownload('DOCX')} disabled={loading}>
                  <Download size={16} className="mr-2" />
                  Download DOCX
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </CandidateLayout>
  );
}
