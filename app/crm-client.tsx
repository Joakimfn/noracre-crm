"use client";
import {prepareInstagramImage} from "@/lib/instagram-image";
import {PhoneLink} from "@/components/phone-link";

import { HealthStatus, OperationsInsights } from "@/components/operations-insights";
import { MailAccount } from "@/components/mail-account";
import { EmailSend } from "@/components/email-send";
import { DeactivationDialog } from "@/components/deactivation-dialog";
import { CustomerFollowups } from "@/components/customer-followups";
import { DateTimePicker } from "@/components/date-time-picker";
import { SocialConnections, type SocialState } from "@/components/social-connections";
import { SOCIAL_CHANNELS } from "@/lib/social-channels";
import { SocialChannelIcon } from "@/components/social-channel-icon";

import { reminderIsDue } from "@/lib/followup-reminder";

import {
  ChangeEvent,
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  Check,
  ChevronsUpDown,
  ChevronRight,
  CirclePlus,
  Clock3,
  Download,
  FileSpreadsheet,
  Gauge,
  Headphones,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { apiFetch, clearStoredSession, getStoredAccessToken } from "@/lib/api-client";

type View =
  | "overview"
  | "customers"
  | "followup"
  | "reports"
  | "calllists"
  | "admin"
  | "marketing"
  | "superadmin"
  | "operations";
type Company = {
  id: number;
  customerType?: string;
  name: string;
  orgNumber: string;
  contactName: string;
  phone: string;
  email: string;
  stage: string;
  nextAction: string;
  nextActionDate: string;
  nextContactId?: number | null;
  note: string;
  address?: string;
  postalCode?: string;
  industry?: string;
  city?: string;
  employees?: number | null;
  revenue?: number | null;
  source?: string;
  assignedTo?: string;
  lastContactAt?: string;
  syncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
type Activity = {
  id: number;
  companyId: number;
  contactId?: number | null;
  companyName: string;
  kind: string;
  note: string;
  dueAt: string;
  completedAt: string;
  createdBy: string;
  createdAt: string;
};
type Member = {
  scheduledDisableAt?: string;
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
};
type Contact = {
  id: number;
  companyId: number;
  name: string;
  title: string;
  phone: string;
  email: string;
  isPrimary: boolean;
};
type Organization = { id: number; name: string; status?: string };
type PriceFields = { crmPrice: string; ringPrice: string; marketingPrice: string };
type NewOrganization = PriceFields & {
  name: string;
  orgNumber: string;
  address: string;
  postalCode: string;
  city: string;
  industry: string;
  organizationPhone: string;
  organizationEmail: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminRole: string;
};
const emptyNewOrganization: NewOrganization = {
  crmPrice: "", ringPrice: "", marketingPrice: "",
  name: "",
  orgNumber: "",
  address: "",
  postalCode: "",
  city: "",
  industry: "",
  organizationPhone: "",
  organizationEmail: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminRole: "Administrator",
};
type Attachment = {
  id: number;
  companyId: number;
  filename: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};
type SupportRequest = {
  id: number;
  organizationId: number;
  requestedBy: string;
  status: string;
  createdAt: string;
};
type OperationOrganization = {
  crmPrice: number | null; ringPrice: number | null; marketingPrice: number | null;
  scheduledDisableAt?: string;
  id: number;
  name: string;
  orgNumber: string;
  address: string;
  postalCode: string;
  city: string;
  industry: string;
  phone: string;
  email: string;
  status: string;
  activeUsers: number;
  lostUsers: number;
  activeSubscriptions: number;
  monthlyAmount: number;
  crmCustomers: number;
  activities30d: number;
  lastActivity: string;
  pendingAccessRequest: boolean;
  hasSupportAccess: boolean;
  baseMonthlyAmount: number;
  moduleMonthly: number;
  ringModuleActive: boolean;
  ringModuleUsers: number;
  marketingModuleActive: boolean;
  marketingModuleUsers: number;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  retainUntil: string;
};
type OperationsData = {
  summary: {
    activeOrganizations: number;
    lostOrganizations: number;
    activeUsers: number;
    lostUsers: number;
    monthlyAmount: number;
    moduleMonthlyAmount: number;
    ringModuleOrganizations: number;
    marketingModuleOrganizations: number;
    serverStatus: string;
  };
  organizations: OperationOrganization[];
};
type OfferTemplate = {
  id: number;
  name: string;
  subject: string;
  body: string;
};
type CallListEntry = Prospect & {
  source: string;
  meetingAt?: string;
  customerId?: number | null;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  handledBy?: string;
};
type Prospect = {
  id: number;
  orgNumber: string;
  name: string;
  industry: string;
  city: string;
  employees: number | null;
  phone: string;
  email: string;
  website: string;
  status: string;
  createdAt: string;
};
type CallListOptions = {
  municipalities: { value: string; label: string }[];
  industries: { value: string; label: string }[];
  organizationForms: { value: string; label: string }[];
};
const organizationFormFallbackOptions = [
  ["ADOS", "Administrativ enhet - offentlig sektor"],
  ["ANNA", "Annen juridisk person"],
  ["ANS", "Ansvarlig selskap med solidarisk ansvar"],
  ["AS", "Aksjeselskap"],
  ["ASA", "Allmennaksjeselskap"],
  ["BA", "Selskap med begrenset ansvar"],
  ["BBL", "Boligbyggelag"],
  ["BO", "Andre bo"],
  ["BRL", "Borettslag"],
  ["DA", "Ansvarlig selskap med delt ansvar"],
  ["ENK", "Enkeltpersonforetak"],
  ["EOFG", "Europeisk økonomisk foretaksgruppe"],
  ["ESEK", "Eierseksjonssameie"],
  ["FKF", "Fylkeskommunalt foretak"],
  ["FLI", "Forening/lag/innretning"],
  ["FYLK", "Fylkeskommune"],
  ["GFS", "Gjensidig forsikringsselskap"],
  ["IKJP", "Andre ikke-juridiske personer"],
  ["IKS", "Interkommunalt selskap"],
  ["KBO", "Konkursbo"],
  ["KF", "Kommunalt foretak"],
  ["KIRK", "Den norske kirke"],
  ["KOMM", "Kommune"],
  ["KS", "Kommandittselskap"],
  ["KTRF", "Kontorfellesskap"],
  ["NUF", "Norskregistrert utenlandsk foretak"],
  ["OPMV", "Særskilt oppdelt enhet, jf. mval. § 2-2"],
  ["ORGL", "Organisasjonsledd"],
  ["PERS", "Andre enkeltpersoner som registreres i tilknyttet register"],
  ["PK", "Pensjonskasse"],
  ["PRE", "Partrederi"],
  ["SA", "Samvirkeforetak"],
  ["SAM", "Tingsrettslig sameie"],
  ["SE", "Europeisk selskap"],
  ["SF", "Statsforetak"],
  ["SPA", "Sparebank"],
  ["STAT", "Staten"],
  ["STI", "Stiftelse"],
  ["SÆR", "Annet foretak iflg. særskilt lov"],
  ["TVAM", "Tvangsregistrert for MVA"],
  ["UTLA", "Utenlandsk enhet"],
  ["VPFO", "Verdipapirfond"],
]
  .map(([value, name]) => ({ value, label: `${name} (${value})` }))
  .sort((a, b) => a.label.localeCompare(b.label, "nb"));
type CallListCache = {
  entries: CallListEntry[];
  options: CallListOptions;
  loadedAt: number;
};
const callListCache = new Map<number, CallListCache>();
const callListLoads = new Map<number, Promise<CallListCache>>();
function loadCallListInitial(organizationId: number, force = false) {
  const cached = callListCache.get(organizationId);
  if (!force && cached && Date.now() - cached.loadedAt < 120_000)
    return Promise.resolve(cached);
  const running = callListLoads.get(organizationId);
  if (!force && running) return running;
  const headers = { "x-organization-id": String(organizationId) };
  const promise = Promise.allSettled([
    apiFetch("/api/call-lists", { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Kunne ikke hente ringelisten");
      return data.entries ?? [];
    }),
    apiFetch("/api/call-list-options", { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Kunne ikke hente filtrene");
      return {
        municipalities: Array.isArray(data.municipalities)
          ? data.municipalities
          : [],
        industries: Array.isArray(data.industries) ? data.industries : [],
        organizationForms:
          Array.isArray(data.organizationForms) && data.organizationForms.length
            ? data.organizationForms
            : organizationFormFallbackOptions,
      } as CallListOptions;
    }),
  ])
    .then(([entriesResult, optionsResult]) => {
      if (entriesResult.status === "rejected") throw entriesResult.reason;
      const entries = entriesResult.value;
      const options =
        optionsResult.status === "fulfilled"
          ? optionsResult.value
          : {
              municipalities: [],
              industries: [],
              organizationForms: organizationFormFallbackOptions,
            };
      const next = { entries, options, loadedAt: Date.now() };
      callListCache.set(organizationId, next);
      callListLoads.delete(organizationId);
      return next;
    })
    .catch((error) => {
      callListLoads.delete(organizationId);
      throw error;
    });
  callListLoads.set(organizationId, promise);
  return promise;
}
const osloDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function osloDateKey(value: Date) {
  const parts = Object.fromEntries(
    osloDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const today = osloDateKey(new Date());
class CallListBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Ringelister failed to render", error);
  }
  render() {
    if (this.state.failed)
      return (
        <div className="page-pad">
          <section className="surface module-error">
            <Phone />
            <h2>Ringelister kunne ikke åpnes</h2>
            <p>Last inn fanen på nytt. Ingen ringelistedata er slettet.</p>
            <Button onClick={() => window.location.reload()}>
              Last inn på nytt
            </Button>
          </section>
        </div>
      );
    return this.props.children;
  }
}
const stages = [
  "Ny kunde",
  "Kontaktet",
  "Møte avtalt",
  "Tilbud sendt",
  "Vunnet",
  "Tapt",
];
const stageClass: Record<string, string> = {
  "Ny kunde": "stage stage-blue",
  Kontaktet: "stage stage-amber",
  "Møte avtalt": "stage stage-teal",
  "Tilbud sendt": "stage stage-purple",
  Vunnet: "stage stage-green",
  Tapt: "stage stage-gray",
};
function date(v: string, time = false) {
  if (!v) return "Ingen dato";
  return new Intl.DateTimeFormat(
    "nb-NO",
    time
      ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short" },
  ).format(new Date(v));
}
function followUpLabel(v?: string) {
  if (!v) return "Ingen planlagt oppfølging";
  const formatted = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(v));
  return `Planlagt oppfølging ${formatted}`;
}
function daysSince(v?: string) {
  if (!v) return "Aldri kontaktet";
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(v).getTime()) / 86400000),
  );
  return days === 0 ? "I dag" : days === 1 ? "1 dag" : `${days} dager`;
}
function fileSize(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
}
const title: Record<View, string> = {
  overview: "Oversikt",
  customers: "Kunder",
  followup: "Oppfølging",
  reports: "Rapporter",
  calllists: "Ringelister",
  admin: "Administrasjon",
  marketing: "Markedsføring",
  superadmin: "Superadmin",
  operations: "Drift og kunder",
};
function icon(kind: string) {
  return kind === "Telefon" ? (
    <Phone size={18} />
  ) : kind === "E-post" ? (
    <Mail size={18} />
  ) : kind === "Møte" ? (
    <Video size={18} />
  ) : (
    <MoreHorizontal size={18} />
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview"),
    [companies, setCompanies] = useState<Company[]>([]),
    [activities, setActivities] = useState<Activity[]>([]),
    [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState(0),
    [query, setQuery] = useState(""),
    [addOpen, setAddOpen] = useState(false),
    [contactOpen, setContactOpen] = useState(false),
    [personOpen, setPersonOpen] = useState(false),
    [contactKind, setContactKind] = useState("Telefon"),
    [contactNote, setContactNote] = useState(""),
    [nextAt, setNextAt] = useState(""),
    [lookupQuery, setLookupQuery] = useState(""),
    [lookupBusy, setLookupBusy] = useState(false),
    [lookupResults, setLookupResults] = useState<Partial<Company>[]>([]),
    [draft, setDraft] = useState<Partial<Company>>({
      stage: "Ny kunde",
      customerType: "Bedrift",
    }),
    [rolePreview, setRolePreview] = useState("Bruker"),
    [supportAccess, setSupportAccess] = useState(false),
    [importRows, setImportRows] = useState<Partial<Company>[]>([]),
    [importName, setImportName] = useState(""),
    [newMember, setNewMember] = useState({
      name: "",
      email: "",
      role: "Bruker",
    }),
    [contacts, setContacts] = useState<Contact[]>([]),
    [selectedContactId, setSelectedContactId] = useState(0),
    [newContact, setNewContact] = useState({
      name: "",
      title: "",
      phone: "",
      email: "",
    }),
    [activeOrgId, setActiveOrgId] = useState(1),
    [organizations, setOrganizations] = useState<Organization[]>([]),
    [newOrg, setNewOrg] = useState<NewOrganization>(emptyNewOrganization),
    [onboardingOpen, setOnboardingOpen] = useState(false),
    [accepted, setAccepted] = useState(false),
    [accessError, setAccessError] = useState({ message: "", code: "" }),
    [attachments, setAttachments] = useState<Attachment[]>([]),
    [uploading, setUploading] = useState(false),
    [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved"),
    [user, setUser] = useState<{id?:string;displayName:string;email:string}>({ displayName: "Min konto", email: "" }),
    [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]),
    [operations, setOperations] = useState<OperationsData | null>(null),
    [currentMembershipId, setCurrentMembershipId] = useState(0),
    [ringModuleActive, setRingModuleActive] = useState(false),
    [marketingModuleActive, setMarketingModuleActive] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [profile, setProfile] = useState({
      displayName: "",
      contactEmail: "",
      theme: "light",
      avatarKey: "",
      avatarX: 50,
      avatarY: 50,
      avatarZoom: 100,
      browserNotifications: false,
    }),
    [profileAvatar, setProfileAvatar] = useState<File | null>(null),
    [profilePreview, setProfilePreview] = useState(""),
    [cropOpen, setCropOpen] = useState(false),
    [avatarVersion, setAvatarVersion] = useState(0),
    [confirmation, setConfirmation] = useState<{
      title: string;
      description: string;
      confirm: () => void;
    } | null>(null),
    [sessionReady, setSessionReady] = useState(false);
  const [pricing, setPricing] = useState<{crmPrice:number|null;ringPrice:number|null;marketingPrice:number|null}>({crmPrice:null,ringPrice:null,marketingPrice:null});
  const [memberModuleCosts,setMemberModuleCosts] = useState<Record<number,number>>({});
  const [memberBusy,setMemberBusy] = useState(false);
  const [deactivation,setDeactivation] = useState<{id:number;name:string;kind:"member"|"organization"}|null>(null);
  async function scheduleDeactivation(effectiveAt:string){
    if(!deactivation)return;
    const r=await api(deactivation.kind==='member'?'/api/admin':'/api/superadmin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(deactivation.kind==='member'?{type:'memberStatus',id:deactivation.id,active:false,effectiveAt}:{type:'organizationStatus',organizationId:deactivation.id,status:'Deaktivert',effectiveAt})});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Kunne ikke deaktivere');
    if(deactivation.kind==='member')setMembers(rows=>rows.map(m=>m.id===data.member.id?{...m,...data.member}:m));
    else setOperations(await api('/api/superadmin').then(r=>r.json()));
    setDeactivation(null);toast.success(effectiveAt?'Deaktivering er planlagt':'Deaktivert');
  }
  const avatarIdentity = JSON.stringify([user.email, activeOrgId, profile.avatarKey, avatarVersion]);
  const [savedAvatar, setSavedAvatar] = useState({ identity: "", url: "" });
  const avatarSrc = profilePreview || (savedAvatar.identity === avatarIdentity ? savedAvatar.url : "");
  const [failedAvatarSrc, setFailedAvatarSrc] = useState("");
  const hasAvatar = Boolean(avatarSrc && avatarSrc !== failedAvatarSrc);
  useEffect(() => {
    if (!sessionReady || !profile.avatarKey) return;
    const controller = new AbortController();
    let objectUrl = "";
    apiFetch(`/api/profile?avatar=1&v=${avatarVersion}`, {
      headers: { "x-organization-id": String(activeOrgId) },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profilbildet");
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSavedAvatar({ identity: avatarIdentity, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSavedAvatar({ identity: avatarIdentity, url: "" });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionReady, avatarIdentity, activeOrgId, profile.avatarKey, avatarVersion]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = (url: string, init: RequestInit = {}) => {
    const h = new Headers(init.headers);
    h.set("x-organization-id", String(activeOrgId));
    return apiFetch(url, { ...init, headers: h });
  };
  async function loadOrganization(orgId: number) {
    const h = { "x-organization-id": String(orgId) };
    const [c, a, ad] = await Promise.all([
      apiFetch("/api/companies", { headers: h }).then((r) => r.json()),
      apiFetch("/api/activities", { headers: h }).then((r) => r.json()),
      apiFetch("/api/admin", { headers: h }).then((r) => r.json()),
    ]);
    if (c.error || a.error || ad.error)
      throw new Error(c.error || a.error || ad.error);
    setRolePreview(ad.role ?? "Bruker");
    setCompanies(c.companies ?? []);
    setActivities(a.activities ?? []);
    setMembers(ad.members ?? []);
    setPricing(ad.pricing ?? {crmPrice:null,ringPrice:null,marketingPrice:null});
    setMemberModuleCosts(ad.memberModuleCosts ?? {});
    setSupportRequests(ad.supportRequests ?? []);
    setSupportAccess(Boolean(ad.activeSupport));
    setCurrentMembershipId(Number(ad.membershipId) || 0);
    const ringActive = Boolean(ad.modules?.ringelister?.currentUserActive);
    setRingModuleActive(ringActive);
    setMarketingModuleActive(
      Boolean(ad.modules?.markedsforing?.currentUserActive),
    );
    if (ringActive) void loadCallListInitial(orgId).catch(() => undefined);
    setSelectedId(c.companies?.[0]?.id ?? 0);
  }
  async function refreshCrmData() {
    const h = { "x-organization-id": String(activeOrgId) },
      [c, a] = await Promise.all([
        apiFetch("/api/companies", { headers: h }).then((r) => r.json()),
        apiFetch("/api/activities", { headers: h }).then((r) => r.json()),
      ]);
    if (!c.error) setCompanies(c.companies ?? []);
    if (!a.error) setActivities(a.activities ?? []);
  }
  useEffect(() => {
    apiFetch("/api/session")
      .then(async (r) => {
        const s = await r.json();
        if (!r.ok)
          throw Object.assign(new Error(s.error ?? "Kunne ikke åpne CRM-et"), {
            code: s.code ?? "",
          });
        return s;
      })
      .then(async (s) => {
        const id = s.currentOrganizationId ?? 1;
        setActiveOrgId(id);
        setOrganizations(s.organizations ?? []);
        setRolePreview(s.role ?? "Bruker");
        if (s.role === "Superadmin") setView("operations");
        setUser(s.user ?? { displayName: "Min konto", email: "" });
        apiFetch("/api/profile", { headers: { "x-organization-id": String(id) } })
          .then((r) => r.json())
          .then((d) => {
            const next = d.profile ?? {};
            setProfile({
              displayName: next.displayName || s.user?.displayName || "",
              contactEmail: next.contactEmail || s.user?.email || "",
              theme: next.theme || "light",
              avatarKey: next.avatarKey || "",
              avatarX: next.avatarX ?? 50,
              avatarY: next.avatarY ?? 50,
              avatarZoom: next.avatarZoom ?? 100,
              browserNotifications: Boolean(next.browserNotifications),
            });
            if (next.displayName)
              setUser((current) => ({
                ...current,
                displayName: next.displayName,
                email: next.contactEmail || current.email,
              }));
          })
          .catch(() => undefined);
        const forceOwnerTutorial =
          s.user?.email?.toLowerCase() === "joakimfn@gmail.com" &&
          localStorage.getItem("noracre-tutorial-2026-09-09-v2") !== "seen";
        setAccepted(Boolean(s.acceptedTermsAt));
        setOnboardingOpen(
          forceOwnerTutorial ||
            !s.acceptedTermsAt ||
            s.acceptedTermsVersion !== "2026-09-09" ||
            !s.completedOnboardingAt,
        );
        setSessionReady(true);
        loadOrganization(id).catch((e) =>
          toast.error(
            e instanceof Error ? e.message : "Kunne ikke hente CRM-data",
          ),
        );
      })
      .catch((e) => {
        setAccessError({
          message: e instanceof Error ? e.message : "Kunne ikke åpne CRM-et",
          code: typeof e?.code === "string" ? e.code : "",
        });
        setSessionReady(true);
      })
      .finally(() => setSessionReady(true));
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", profile.theme === "dark" || (profile.theme === "system" && media.matches));
    apply();
    if (profile.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile.theme]);
  async function saveProfile() {
    const previousUser = user;
    setUser(current => ({...current, displayName: profile.displayName, email: profile.contactEmail}));
    setProfileOpen(false);
    toast.success("Innstillingene er lagret");
    const form = new FormData();
    form.set("displayName", profile.displayName);
    form.set("contactEmail", profile.contactEmail);
    form.set("theme", profile.theme);
    form.set("avatarX", String(profile.avatarX));
    form.set("avatarY", String(profile.avatarY));
    form.set("avatarZoom", String(profile.avatarZoom));
    form.set("browserNotifications", String(profile.browserNotifications));
    if (profileAvatar) form.set("avatar", profileAvatar);
    const r = await api("/api/profile", { method: "POST", body: form }),
      d = await r.json();
    if (!r.ok) {
      setUser(previousUser);
      setProfileOpen(true);
      return toast.error(d.error ?? "Kunne ikke lagre innstillingene");
    }
    setUser(current => ({...current,
      displayName: d.profile.displayName,
      email: d.profile.contactEmail,
    }));
    setProfile(d.profile);
    setProfileAvatar(null);
    if (profilePreview) URL.revokeObjectURL(profilePreview);
    setProfilePreview("");
    setAvatarVersion((v) => v + 1);
  }
  const filtered = useMemo(
      () =>
        companies.filter((c) =>
          `${c.name} ${c.contactName} ${c.orgNumber}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      [companies, query],
    ),
    selected = companies.find((c) => c.id === selectedId) ?? companies[0],
    pending = activities.filter((a) => !a.completedAt && a.dueAt),
    overdue = pending.filter((a) => a.dueAt.slice(0, 10) < today),
    dueToday = pending.filter((a) => a.dueAt.slice(0, 10) === today),
    upcoming = pending.filter((a) => a.dueAt.slice(0, 10) > today),
    noFollow = companies.filter((c) => !c.nextActionDate);
  useEffect(() => {
    if (
      !sessionReady ||
      !profile.browserNotifications ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const check = () => {
      const now = Date.now();
      for (const activity of activities) {
        if (!reminderIsDue(activity, now)) continue;
        const due = new Date(activity.dueAt).getTime();
        const key = `noracre-reminder:${user.id}:${activeOrgId}:${activity.id}:${activity.dueAt}`;
        if (localStorage.getItem(key)) continue;
        const notification = new Notification("Kommende oppfølging", {
          body: `${activity.companyName}: ${activity.note || "Følg opp"} – kl. ${new Date(due).toLocaleTimeString("nb-NO", {hour: "2-digit", minute: "2-digit"})}`,
          tag: key,
        });
        notification.onclick = () => { window.focus(); setView("followup"); notification.close(); };
        localStorage.setItem(key, "sent");
      }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [sessionReady, profile.browserNotifications, activities, activeOrgId, user.id]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setContacts([]);
        setSelectedContactId(0);
        setAttachments([]);
      }
    });
    Promise.all([
      api(`/api/contacts?companyId=${selected.id}`, {
        signal: controller.signal,
      }).then((r) => r.json()),
      api(`/api/attachments?companyId=${selected.id}`, {
        signal: controller.signal,
      }).then((r) => r.json()),
    ])
      .then(([contactData, fileData]) => {
        if (controller.signal.aborted) return;
        const rows = contactData.contacts ?? [];
        setContacts(rows);
        setSelectedContactId(rows[0]?.id ?? 0);
        setAttachments(fileData.attachments ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setContacts([]);
          setSelectedContactId(0);
          setAttachments([]);
        }
      });
    return () => controller.abort();
  }, [selectedId, activeOrgId]);
  const reloadActivities = () =>
    api("/api/activities")
      .then((r) => r.json())
      .then((d) => setActivities(d.activities ?? []))
      .catch(() => undefined);
  const persist = async (c: Company) => {
    if (c.id <= 0) return true;
    try {
      return (
        await api("/api/companies", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(c),
        })
      ).ok;
    } catch {
      return false;
    }
  };
  const updateSelected = (v: Partial<Company>) => {
    const updated = { ...selected, ...v };
    setCompanies((rows) =>
      rows.map((x) => (x.id === selected.id ? updated : x)),
    );
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await persist(updated);
      setSaveState(ok ? "saved" : "error");
      if (
        ok &&
        (Object.hasOwn(v, "nextAction") ||
          Object.hasOwn(v, "nextActionDate") ||
          Object.hasOwn(v, "nextContactId"))
      )
        await reloadActivities();
    }, 650);
  };
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (view === "operations")
      api("/api/superadmin")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setOperations(d);
        })
        .catch(() => setOperations(null));
  }, [view]);
  async function lookup() {
    if (!lookupQuery.trim()) return;
    setLookupBusy(true);
    try {
      const r = await apiFetch(
          `/api/company-lookup?q=${encodeURIComponent(lookupQuery)}`,
        ),
        d = await r.json();
      setLookupResults(d.companies ?? []);
      if (!r.ok)
        toast.error(d.error ?? "Kunne ikke søke i Brønnøysundregistrene");
    } catch {
      setLookupResults([]);
      toast.error("Kunne ikke søke i Brønnøysundregistrene");
    } finally {
      setLookupBusy(false);
    }
  }
  async function saveCompany() {
    if (!draft.name) return;
    const isPerson = draft.customerType === "Person",
      c: Company = {
        id: Date.now(),
        customerType: isPerson ? "Person" : "Bedrift",
        name: draft.name,
        orgNumber: isPerson ? "" : (draft.orgNumber ?? ""),
        contactName: isPerson ? draft.name : (draft.contactName ?? ""),
        phone: draft.phone ?? "",
        email: draft.email ?? "",
        stage: draft.stage ?? "Ny kunde",
        nextAction: "",
        nextActionDate: "",
        note: "",
        industry: draft.industry,
        city: draft.city,
        employees: draft.employees,
        revenue: draft.revenue,
        source: isPerson ? "Manuelt" : draft.source,
        assignedTo: "Joakim",
      };
    try {
      const r = await api("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c),
      });
      if (r.ok) c.id = (await r.json()).company.id;
    } catch {}
    setCompanies((x) => [c, ...x]);
    setSelectedId(c.id);
    setDraft({ stage: "Ny kunde", customerType: "Bedrift" });
    setLookupResults([]);
    setLookupQuery("");
    setAddOpen(false);
    toast.success("Kunden er lagt til");
  }
  async function uploadAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected || selected.id < 0) return;
    setUploading(true);
    const form = new FormData();
    form.set("companyId", String(selected.id));
    form.set("file", file);
    try {
      const r = await api("/api/attachments", { method: "POST", body: form }),
        d = await r.json();
      if (!r.ok) return toast.error(d.error ?? "Kunne ikke laste opp filen");
      setAttachments((x) => [d.attachment, ...x]);
      toast.success("Vedlegget er lastet opp");
    } finally {
      setUploading(false);
    }
  }
  async function downloadAttachment(file: Attachment) {
    const r = await api(`/api/attachments?id=${file.id}`);
    if (!r.ok) return toast.error("Kunne ikke laste ned filen");
    const url = URL.createObjectURL(await r.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAttachment(file: Attachment) {
    const r = await api(`/api/attachments?id=${file.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Kunne ikke slette vedlegget");
    setAttachments((x) => x.filter((a) => a.id !== file.id));
    toast.success("Vedlegget er slettet");
  }
  async function register() {
    const before = selected,
      now = new Date().toISOString(),
      contactId = selectedContactId || null,
      kind = contactKind,
      note = contactNote,
      due = nextAt,
      tempId = -Date.now(),
      a: Activity = {
        id: tempId,
        companyId: before.id,
        contactId,
        companyName: before.name,
        kind,
        note,
        dueAt: "",
        completedAt: now,
        createdBy: user.displayName,
        createdAt: now,
      },
      followup: Activity | null = due
        ? {
            id: tempId - 1,
            companyId: before.id,
            contactId,
            companyName: before.name,
            kind,
            note: `Følg opp etter ${kind.toLowerCase()}`,
            dueAt: due,
            completedAt: "",
            createdBy: user.displayName,
            createdAt: now,
          }
        : null;
    setActivities((x) => [a, ...(followup ? [followup] : []), ...x]);
    setCompanies((x) =>
      x.map((c) =>
        c.id === before.id
          ? {
              ...c,
              lastContactAt: now,
              nextAction: followup?.note ?? "",
              nextActionDate: due,
              nextContactId: contactId,
            }
          : c,
      ),
    );
    setContactOpen(false);
    setContactNote("");
    setNextAt("");
    toast.success(`${kind} er registrert`);
    try {
      const r = await api("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...a,
          contactId,
          nextAction: followup?.note ?? "",
          nextActionDate: due,
          followupKind: kind,
        }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      await refreshCrmData();
      setActivities((x) =>
        x.map((item) =>
          item.id === tempId
            ? { ...item, id: d.activity.id }
            : item.id === tempId - 1 && d.followup
              ? { ...item, id: d.followup.id }
              : item,
        ),
      );
    } catch {
      setActivities((x) =>
        x.filter((item) => item.id !== tempId && item.id !== tempId - 1),
      );
      setCompanies((x) => x.map((c) => (c.id === before.id ? before : c)));
      toast.error("Aktiviteten kunne ikke lagres. Prøv igjen.");
    }
  }
  async function complete(a: Activity) {
    const done = new Date().toISOString();
    setActivities((x) =>
      x.map((y) => (y.id === a.id ? { ...y, completedAt: done } : y)),
    );
    try {
      const response = await api("/api/activities", {method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({id:a.id,completedAt:done})});
      if (!response.ok) throw new Error();
      await refreshCrmData();
    } catch { await reloadActivities(); toast.error("Kunne ikke fullføre oppfølgingen"); return; }
    toast.success("Markert som utført");
  }
  async function deleteHistory(a: Activity) {
    const r = await api(`/api/activities?id=${a.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Kunne ikke slette hendelsen");
    setActivities((x) => x.filter((item) => item.id !== a.id));
    toast.success("Hendelsen er slettet");
  }
  async function refresh(c: Company) {
    if (!c.orgNumber) return toast.error("Organisasjonsnummer mangler");
    const d = await (
        await apiFetch(`/api/company-lookup?q=${encodeURIComponent(c.orgNumber)}`)
      ).json(),
      f = d.companies?.[0];
    if (!f) return toast.error("Fant ikke bedriften");
    const u = {
      ...c,
      ...f,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      note: c.note,
      syncedAt: new Date().toISOString(),
    };
    setCompanies((x) => x.map((y) => (y.id === c.id ? u : y)));
    await persist(u);
    toast.success("Bedriftsdata er oppdatert");
  }
  async function readExcel(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Importfilen kan være maks 5 MB.");
    setImportName(f.name);
    const b = XLSX.read(await f.arrayBuffer(), { sheetRows: 501, sheets: 0 }),
      raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        b.Sheets[b.SheetNames[0]],
        { defval: "" },
      );
    const rows = raw
      .slice(0, 500)
      .map((r) => {
        const pick = (...ks: string[]) => {
          for (const k of ks) {
            const h = Object.keys(r).find((x) => x.toLowerCase().includes(k));
            if (h && r[h]) return String(r[h]);
          }
          return "";
        };
        return {
          name: pick("bedrift", "firmanavn", "kunde", "company"),
          orgNumber: pick("org", "organisasjon"),
          contactName: pick("kontakt", "contact"),
          phone: pick("telefon", "mobil", "phone"),
          email: pick("e-post", "epost", "email"),
          note: pick("notat", "kommentar", "note"),
          stage: "Ny kunde",
          assignedTo: "Joakim",
          source: "Excel-import",
        };
      })
      .filter((r) => r.name);
    setImportRows(rows);
    toast.success(`${rows.length} kunder klare for import`);
  }
  async function doImport() {
    const r = await api("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companies: importRows }),
    });
    const rows = r.ok ? (await r.json()).companies : [];
    setCompanies((x) => [...rows, ...x]);
    setImportRows([]);
    toast.success(`${rows.length} kunder er importert`);
  }
  function calendar() {}
  async function addMember(confirmed = false) {
    if (memberBusy || !newMember.name || !newMember.email) return;
    if (pricing.crmPrice == null) return toast.error("Pris er ikke avtalt. Oppgi pris under Drift først.");
    if (!confirmed)
      return setConfirmation({
        title: "Aktiver ny bruker?",
        description: `${newMember.name} opprettes som aktiv bruker. Abonnementet øker med ${pricing.crmPrice} kr per måned eks. mva.`,
        confirm: () => {
          setConfirmation(null);
          void addMember(true);
        },
      });
    setMemberBusy(true);
    const m: Member = { id: Date.now(), ...newMember, phone: "", active: true };
    try {
      const r = await api("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "member", ...newMember, acceptedPrice: pricing.crmPrice }),
      });
      const d = await r.json();
      if (!r.ok) return toast.error(d.error ?? "Kunne ikke invitere brukeren");
      m.id = d.member.id;
      await navigator.clipboard?.writeText(window.location.origin)
        .catch(() => undefined);
      setMembers((x) => [...x, m]);
      setNewMember({ name: "", email: "", role: "Bruker" });
      toast.success(d.invitationSent ? "Brukeren er opprettet og invitasjonen er sendt" : "Brukeren er opprettet. Invitasjonen kunne ikke sendes; del innloggingslenken manuelt.");
    } catch {
      toast.error("Kunne ikke invitere brukeren");
    } finally { setMemberBusy(false); }
  }
  async function setMemberStatus(
    member: Member,
    active: boolean,
    confirmed = false,
  ) {
    if(active && !member.active && pricing.crmPrice == null) return toast.error("Pris er ikke avtalt. Oppgi pris under Drift først.");
    if(!active&&!confirmed)return setDeactivation({id:member.id,name:member.name,kind:'member'});
    if (!confirmed)
      return setConfirmation({
        title: active ? "Aktiver bruker?" : "Deaktiver bruker?",
        description: active
          ? member.active ? `Planlagt deaktivering av ${member.name} avbrytes. Ingen nye kostnader.` : `${member.name} får tilgang igjen. Abonnementet øker med ${(pricing.crmPrice ?? 0) + (memberModuleCosts[member.id] ?? 0)} kr per måned eks. mva., inkludert eventuelle eksisterende modullisenser.`
          : `${member.name} mister tilgangen umiddelbart. Dataene slettes ikke.`,
        confirm: () => {
          setConfirmation(null);
          void setMemberStatus(member, active, true);
        },
      });
    const r = await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "memberStatus", id: member.id, active, acceptedPrice: pricing.crmPrice == null ? null : pricing.crmPrice + (memberModuleCosts[member.id] ?? 0) }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error ?? "Kunne ikke endre brukeren");
    setMembers((rows) =>
      rows.map((row) => (row.id === member.id ? { ...row, ...d.member } : row)),
    );
    toast.success(active ? "Brukeren er aktivert" : "Brukeren er deaktivert");
  }
  async function support(v: boolean) {
    setSupportAccess(v);
    await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "support", enabled: v }),
    }).catch(() => undefined);
    toast.success(
      v ? "Support har tilgang i 24 timer" : "Supporttilgangen er stengt",
    );
  }
  async function addContact() {
    if (!newContact.name || !selected) return;
    const c: Contact = {
      id: Date.now(),
      companyId: selected.id,
      ...newContact,
      isPrimary: contacts.length === 0,
    };
    try {
      const r = await api("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c),
      });
      if (r.ok) c.id = (await r.json()).contact.id;
    } catch {}
    setContacts((x) => [...x, c]);
    setSelectedContactId(c.id);
    setNewContact({ name: "", title: "", phone: "", email: "" });
    setPersonOpen(false);
    toast.success("Kontaktpersonen er lagt til");
  }
  async function addOrganization() {
    if (!newOrg.name || !newOrg.adminEmail) return;
    if (newOrg.crmPrice === "") return toast.error("Oppgi avtalt pris per CRM-bruker.");
    const r = await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "organization", ...newOrg }),
    });
    if (!r.ok)
      return toast.error(
        (await r.json()).error ?? "Kunne ikke opprette organisasjonen",
      );
    const org = (await r.json()).organization;
    setOrganizations((x) => [...x, org]);
    setNewOrg(emptyNewOrganization);
    toast.success("Kundeorganisasjonen er opprettet");
  }
  async function switchOrganization(id: number) {
    try {
      await loadOrganization(id);
      setActiveOrgId(id);
      setView("overview");
      toast.success("Organisasjonen er byttet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Du har ikke tilgang");
    }
  }
  async function requestSupportAccess(id: number) {
    const r = await api("/api/superadmin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "requestAccess", organizationId: id }),
    });
    if (!r.ok) return toast.error("Kunne ikke sende forespørselen");
    setOperations((d) =>
      d
        ? {
            ...d,
            organizations: d.organizations.map((o) =>
              o.id === id ? { ...o, pendingAccessRequest: true } : o,
            ),
          }
        : d,
    );
    toast.success("Tilgangsforespørselen er sendt");
  }
  async function setOrganizationStatus(
    id: number,
    status: string,
    confirmed = false,
  ) {
    if(status==='Deaktivert'&&!confirmed)return setDeactivation({id,name:operations?.organizations.find(o=>o.id===id)?.name||'Bedriften',kind:'organization'});
    const r = await api("/api/superadmin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "organizationStatus",
        organizationId: id,
        status,
      }),
    });
    if (!r.ok) return toast.error("Kunne ikke endre status");
    const d = await api("/api/superadmin").then((x) => x.json());
    setOperations(d);
  }
  async function updateOrganizationDetails(
    id: number,
    details: Pick<
      OperationOrganization,
      | "name"
      | "orgNumber"
      | "address"
      | "postalCode"
      | "city"
      | "industry"
      | "phone"
      | "email"
    > & PriceFields,
  ) {
    const r = await api("/api/superadmin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "organizationDetails",
          organizationId: id,
          ...details,
        }),
      }),
      d = await r.json();
    if (!r.ok) {
      toast.error(d.error ?? "Kunne ikke lagre bedriftsinformasjonen");
      return false;
    }
    const refreshed = await api("/api/superadmin").then(r=>r.json());
    if (!refreshed.error) setOperations(refreshed);
    await loadOrganization(activeOrgId);
    toast.success("Bedriftsinformasjonen er lagret");
    return true;
  }
  async function approveSupport(requestId: number) {
    const r = await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "supportApproval", requestId }),
    });
    if (!r.ok) return toast.error("Kunne ikke godkjenne tilgangen");
    setSupportAccess(true);
    setSupportRequests((x) => x.filter((item) => item.id !== requestId));
    toast.success("Support har tilgang i 24 timer");
  }
  async function finishOnboarding() {
    if (!accepted) return;
    localStorage.setItem("noracre-tutorial-2026-09-09-v2", "seen");
    setOnboardingOpen(false);
    toast.success("Du er klar til å bruke Noracre CRM");
    const r = await apiFetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptedTerms: true, completedOnboarding: true }),
    });
    if (!r.ok) {
      setOnboardingOpen(true);
      return toast.error("Kunne ikke lagre godkjenningen");
    }
  }
  async function exportBackup() {
    const r = await api("/api/export");
    if (!r.ok) return toast.error("Kunne ikke lage sikkerhetskopi");
    const d = await r.json(),
      book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(d.companies ?? []),
      "Kunder",
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(d.contacts ?? []),
      "Kontaktpersoner",
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(d.activities ?? []),
      "Historikk",
    );
    XLSX.writeFile(book, `noracre-crm-sikkerhetskopi-${today}.xlsx`);
    toast.success("Sikkerhetskopien er lastet ned");
  }
  if (!sessionReady)
    return (
      <main className="session-loading" role="status" aria-live="polite" aria-label="Åpner Noracre CRM">
        <img src="/noracre-logo-primary.svg" alt="Noracre" />
        <span>Gjør klart arbeidsområdet ditt …</span>
      </main>
    );
  if (accessError.message)
    return (
      <AccessDenied message={accessError.message} code={accessError.code} />
    );
  return (
    <main className="app-shell signature-shell">
      <Toaster position="top-right" />
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-wordmark brand-wordmark-light"
            src="/noracre-logo-primary.svg"
            alt="Noracre"
          />
          <img className="brand-wordmark brand-wordmark-dark" src="/noracre-logo-dark.svg" alt="Noracre" />
          <img
            className="brand-icon brand-icon-sidebar"
            src="/noracre-app-icon.svg"
            alt="Noracre"
          />
        </div>
        <nav aria-label="Hovedmeny">
          <Nav
            a={view === "overview"}
            click={() => setView("overview")}
            ico={<LayoutDashboard size={20} />}
            text="Oversikt"
          />
          <Nav
            a={view === "customers"}
            click={() => setView("customers")}
            ico={<UsersRound size={20} />}
            text="Kunder"
          />
          <Nav
            a={view === "followup"}
            click={() => setView("followup")}
            ico={<CalendarCheck2 size={20} />}
            text="Oppfølging"
            count={overdue.length + dueToday.length}
          />
          <Nav
            a={view === "reports"}
            click={() => setView("reports")}
            ico={<BarChart3 size={20} />}
            text="Rapporter"
          />
          {(["Administrator", "Superadmin"].includes(rolePreview) || ringModuleActive) && (
          <Nav
            a={view === "calllists"}
            click={() => setView("calllists")}
            ico={<Phone size={20} />}
            text="Ringelister"
          />
          )}
          {(["Administrator", "Superadmin"].includes(rolePreview) || marketingModuleActive) && (
          <Nav
            a={view === "marketing"}
            click={() => setView("marketing")}
            ico={<Megaphone size={20} />}
            text="Markedsføring"
          />
          )}
          {rolePreview !== "Bruker" && (
            <Nav
              a={view === "admin"}
              click={() => {
                setNewMember({ name: "", email: "", role: "Bruker" });
                setView("admin");
              }}
              ico={<Settings size={20} />}
              text="Administrasjon"
            />
          )}
        </nav>
        {rolePreview === "Superadmin" && (
          <nav className="super-nav" aria-label="Superadmin">
            <Nav
              a={view === "operations"}
              click={() => setView("operations")}
              ico={<Gauge size={20} />}
              text="Drift"
            />
            <Nav
              a={view === "superadmin"}
              click={() => {
                setNewMember({ name: "", email: "", role: "Superadmin" });
                setView("superadmin");
              }}
              ico={<ShieldCheck size={20} />}
              text="Superadmin"
            />
          </nav>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="sidebar-foot account-trigger" title={user.displayName} aria-label={`Konto: ${user.displayName}`}>
              <div className="avatar">
                {hasAvatar && (
                  <img
                    key={avatarSrc}
                    src={avatarSrc}
                    onError={() => setFailedAvatarSrc(avatarSrc)}
                    alt=""
                    style={{
                      left: `${profile.avatarX}%`,
                      top: `${profile.avatarY}%`,
                      transform: `translate(-50%, -50%) scale(${profile.avatarZoom / 100})`,
                    }}
                  />
                )}
                {!hasAvatar && <span>
                  {user.displayName
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase()}
                </span>}
              </div>
              <div>
                <strong>{user.displayName}</strong>
                <span>{rolePreview}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="break-all">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <Settings />
              Innstillinger
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const usesSupabase = Boolean(getStoredAccessToken());
                clearStoredSession();
                window.location.assign(
                  usesSupabase ? "/" : "/signout-with-chatgpt?return_to=/",
                );
              }}
            >
              <LogOut />
              Logg ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mine innstillinger</DialogTitle>
            <DialogDescription>
              Profilen og utseendet gjelder bare brukeren din.
            </DialogDescription>
          </DialogHeader>
          <div className="profile-settings">
            <Label>Profilbilde</Label>
            <div className="profile-photo-row">
              <div className="avatar large">
                {hasAvatar && (
                  <img
                    key={avatarSrc}
                    src={avatarSrc}
                    onError={() => setFailedAvatarSrc(avatarSrc)}
                    alt=""
                    style={{
                      left: `${profile.avatarX}%`,
                      top: `${profile.avatarY}%`,
                      transform: `translate(-50%, -50%) scale(${profile.avatarZoom / 100})`,
                    }}
                  />
                )}
                {!hasAvatar && <span>
                  {profile.displayName
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase()}
                </span>}
              </div>
              <label className="photo-upload-button">
                Velg bilde
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    setProfileAvatar(file);
                    if (profilePreview) URL.revokeObjectURL(profilePreview);
                    setProfilePreview(URL.createObjectURL(file));
                    setProfile({
                      ...profile,
                      avatarX: 50,
                      avatarY: 50,
                      avatarZoom: 100,
                    });
                    setCropOpen(true);
                    e.target.value = "";
                  }}
                />
              </label>
              {avatarSrc && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCropOpen(true)}
                >
                  Rediger bilde
                </Button>
              )}
            </div>
            <Label>Navn</Label>
            <Input
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
            />
            <Label>E-post</Label>
            <Input
              type="email"
              value={profile.contactEmail}
              onChange={(e) =>
                setProfile({ ...profile, contactEmail: e.target.value })
              }
            />
            <Label>Tema</Label>
            <Select
              value={profile.theme}
              onValueChange={(theme) => setProfile({ ...profile, theme })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Følg systemet</SelectItem>
                <SelectItem value="light">Lys modus</SelectItem>
                <SelectItem value="dark">Mørk modus</SelectItem>
              </SelectContent>
            </Select>
            <div className="setting-row">
              <div>
                <strong>Nettleservarsler</strong>
                <span>Varsle 15 minutter før oppfølgingen. CRM-et må være åpent og nettleservarsler tillatt.</span>
              </div>
              <Switch
                checked={profile.browserNotifications}
                onCheckedChange={async (enabled) => {
                  if (enabled && !("Notification" in window)) return toast.error("Denne nettleseren støtter ikke nettleservarsler. Du kan fortsatt bruke CRM-et.");
                  if (
                    enabled &&
                    "Notification" in window &&
                    (await Notification.requestPermission()) !== "granted"
                  )
                    return toast.error("Tillat varsler i nettleseren først");
                  setProfile({ ...profile, browserNotifications: enabled });
                }}
              />
            </div>
            <p className="form-hint">
              Når egen innlogging kobles til, må endring av innloggings-e-post
              bekreftes via e-post.
            </p>
            <Button onClick={saveProfile}>Lagre innstillinger</Button>
          </div>
          <MailAccount organizationId={activeOrgId}/>
        </DialogContent>
      </Dialog>
      <AvatarCropDialog
        open={cropOpen}
        setOpen={setCropOpen}
        src={avatarSrc}
        x={profile.avatarX}
        y={profile.avatarY}
        zoom={profile.avatarZoom}
        change={(next) => setProfile({ ...profile, ...next })}
      />
      <DeactivationDialog target={deactivation} onClose={()=>setDeactivation(null)} onConfirm={scheduleDeactivation}/>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmation?.confirm()}>
              Bekreft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className={`workspace view-${view}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">NORACRE CRM</p>
            <h1>{title[view]}</h1>
          </div>
          <div className="top-actions">
            {view === "customers" && (
              <span className={`save-state ${saveState}`}>
                {saveState === "saving"
                  ? "Lagrer …"
                  : saveState === "error"
                    ? "Kunne ikke lagre"
                    : "Alle endringer lagret"}
              </span>
            )}
            {view === "customers" && (
              <Add
                showTrigger={false}
                open={addOpen}
                setOpen={setAddOpen}
                q={lookupQuery}
                setQ={setLookupQuery}
                busy={lookupBusy}
                lookup={lookup}
                results={lookupResults}
                draft={draft}
                setDraft={setDraft}
                save={saveCompany}
              />
            )}
          </div>
        </header>
        {view === "overview" && (
          <Overview
            displayName={user.displayName}
            companies={companies}
            overdue={overdue}
            today={dueToday}
            upcoming={upcoming}
            go={setView}
            complete={complete}
            select={(id) => {
              setSelectedId(id);
              setView("customers");
            }}
          />
        )}{" "}
        {view === "customers" &&
          (selected ? (
            <Customers
              list={filtered}
              selected={selected}
              query={query}
              setQuery={setQuery}
              select={setSelectedId}
              update={updateSelected}
              contact={(k) => {
                setContactKind(k);
                setContactOpen(true);
              }}
              refresh={refresh}
              onFollowupsChanged={refreshCrmData}
              activityRevision={activities}
              contacts={contacts}
              selectedContactId={selectedContactId}
              selectContact={setSelectedContactId}
              addContact={() => setPersonOpen(true)}
              history={activities.filter(
                (a) => a.companyId === selected.id && !!a.completedAt,
              )}
              removeHistory={deleteHistory}
              attachments={attachments}
              uploading={uploading}
              upload={uploadAttachment}
              download={downloadAttachment}
              removeAttachment={deleteAttachment}
              organizationId={activeOrgId}
              add={() => setAddOpen(true)}
            />
          ) : (
            <EmptyCustomers add={() => setAddOpen(true)} />
          ))}{" "}
        {view === "followup" && (
          <Follow
            overdue={overdue}
            today={dueToday}
            upcoming={upcoming}
            none={noFollow}
            complete={complete}
            select={(id) => {
              setSelectedId(id);
              setView("customers");
            }}
            calendar={calendar}
          />
        )}{" "}
        {view === "reports" && (
          <Reports
            companies={companies}
            activities={activities}
            members={members}
            role={rolePreview}
            currentUser={user.displayName}
          />
        )}{" "}
        {view === "calllists" && (["Administrator", "Superadmin"].includes(rolePreview) || ringModuleActive) && (
          <CallListBoundary>
            <CallLists
            agreedPrice={pricing.ringPrice}
              active={ringModuleActive}
              role={rolePreview}
              members={members}
              organizationId={activeOrgId}
              currentMembershipId={currentMembershipId}
              onActivated={(enabled) => setRingModuleActive(enabled)}
              onDataChanged={refreshCrmData}
              onGoToCustomer={(company) => {
                setCompanies((rows) => [
                  company,
                  ...rows.filter((row) => row.id !== company.id),
                ]);
                setSelectedId(company.id);
                setView("customers");
              }}
            />
          </CallListBoundary>
        )}{" "}
        {view === "marketing" && (["Administrator", "Superadmin"].includes(rolePreview) || marketingModuleActive) && (
          <Marketing
            agreedPrice={pricing.marketingPrice}
            key={activeOrgId}
            active={marketingModuleActive}
            role={rolePreview}
            members={members}
            organizationId={activeOrgId}
            currentMembershipId={currentMembershipId}
            companies={companies}
            onActivated={setMarketingModuleActive}
          />
        )}{" "}
        {view === "admin" && (
          <Admin
            members={members}
            role={rolePreview}
            userEmail={user.email}
            supportAccess={supportAccess}
            support={support}
            supportRequests={supportRequests}
            approveSupport={approveSupport}
            readExcel={readExcel}
            rows={importRows}
            importName={importName}
            doImport={doImport}
            newMember={newMember}
            setNewMember={setNewMember}
            addMember={addMember}
            setMemberStatus={setMemberStatus}
            companies={companies}
            refresh={refresh}
            organizations={organizations}
            activeOrgId={activeOrgId}
            switchOrg={switchOrganization}
            exportBackup={exportBackup}
          />
        )}{" "}
        {view === "operations" && rolePreview === "Superadmin" && (
          <Operations
            data={operations}
            openOrganization={async (id) => {
              await switchOrganization(id);
              setView("overview");
            }}
            requestAccess={requestSupportAccess}
            setStatus={setOrganizationStatus}
            updateDetails={updateOrganizationDetails}
          />
        )}
        {view === "superadmin" && rolePreview === "Superadmin" && (
          <SuperadminSettings
            newOrg={newOrg}
            setNewOrg={setNewOrg}
            addOrg={addOrganization}
            members={members}
            newMember={newMember}
            setNewMember={setNewMember}
            addMember={addMember}
            ownerEmail={user.email}
          />
        )}
      </section>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrer {contactKind.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {selected?.name} · det tar bare noen sekunder.
            </DialogDescription>
          </DialogHeader>
          <div className="contact-kind-row">
            {["Telefon", "E-post", "Møte", "Annet"].map((k) => (
              <button
                key={k}
                className={contactKind === k ? "active" : ""}
                onClick={() => setContactKind(k)}
              >
                {icon(k)}
                {k}
              </button>
            ))}
          </div>
          <Label>Hvem snakket du med?</Label>
          <Select
            value={selectedContactId ? String(selectedContactId) : "none"}
            onValueChange={(v) =>
              setSelectedContactId(v === "none" ? 0 : Number(v))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen valgt kontakt</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                  {c.title ? ` · ${c.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>Hva skjedde?</Label>
          <Textarea
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            placeholder="Kort notat …"
          />
          <Label>Når skal kunden følges opp igjen?</Label>
          <DateTimePicker label="Neste oppfølging" value={nextAt} onChange={setNextAt}/>
          <Button onClick={register}>Lagre kontakten</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={personOpen} onOpenChange={setPersonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Legg til kontaktperson</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          <Label>Navn</Label>
          <Input
            value={newContact.name}
            onChange={(e) =>
              setNewContact({ ...newContact, name: e.target.value })
            }
          />
          <Label>Stilling</Label>
          <Input
            value={newContact.title}
            onChange={(e) =>
              setNewContact({ ...newContact, title: e.target.value })
            }
          />
          <Label>Telefon</Label>
          <Input
            value={newContact.phone}
            onChange={(e) =>
              setNewContact({ ...newContact, phone: e.target.value })
            }
          />
          <Label>E-post</Label>
          <Input
            value={newContact.email}
            onChange={(e) =>
              setNewContact({ ...newContact, email: e.target.value })
            }
          />
          <Button onClick={addContact}>Legg til kontaktpersonen</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={onboardingOpen} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Velkommen til Noracre CRM</DialogTitle>
            <DialogDescription>
              Her er arbeidsflyten du trenger for å komme raskt i gang.
            </DialogDescription>
          </DialogHeader>
          <div className="onboarding-grid">
            <div>
              <UsersRound />
              <div>
                <strong>Kunder og kontaktpersoner</strong>
                <span>
                  Søk i Brønnøysundregistrene, registrer aktiviteter og lagre
                  vedlegg.
                </span>
              </div>
            </div>
            <div>
              <CalendarCheck2 />
              <div>
                <strong>Oppfølging</strong>
                <span>
                  Planlegg neste steg og få varsler om det som må gjøres.
                </span>
              </div>
            </div>
            <div>
              <Phone />
              <div>
                <strong>Ringelister</strong>
                <span>
                  Lag målrettede lister, registrer resultatet og flytt
                  prospekter til kundekort.
                </span>
              </div>
            </div>
            <div>
              <BarChart3 />
              <div>
                <strong>Tilbud og rapporter</strong>
                <span>
                  Send tilbud fra kundekortet og følg dine egne salgsresultater.
                </span>
              </div>
            </div>
          </div>
          <label className="terms-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Jeg godtar{" "}
              <a href="/vilkar" target="_blank">
                vilkårene
              </a>{" "}
              og har lest{" "}
              <a href="/personvern" target="_blank">
                personvernerklæringen
              </a>{" "}
              og{" "}
              <a href="/databehandleravtale" target="_blank">
                databehandleravtalen
              </a>
              . Dersom jeg handler på vegne av en bedrift, bekrefter jeg at jeg
              har fullmakt til dette.
            </span>
          </label>
          <Button disabled={!accepted} onClick={finishOnboarding}>
            Start Noracre CRM
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function AccessDenied({ message, code }: { message: string; code: string }) {
  const disabled = code === "USER_DISABLED" || code === "ORGANIZATION_DISABLED";
  return (
    <main className="access-page">
      <section>
        <img className="brand-icon" src="/noracre-app-icon.svg" alt="" />
        <h1>
          {code === "USER_DISABLED"
            ? "Bruker deaktivert"
            : code === "ORGANIZATION_DISABLED"
              ? "Bedrift deaktivert"
              : "Du har ikke tilgang ennå"}
        </h1>
        <p>{message}</p>
        {!disabled && (
          <p>
            Be administratoren i bedriften invitere e-postadressen du logget inn
            med.
          </p>
        )}
        <p className="disabled-support">
          Kontakt support dersom dette ikke skulle ha skjedd.
        </p>
      </section>
    </main>
  );
}

function EmptyCustomers({ add }: { add: () => void }) {
  return (
    <div className="page-pad">
      <section className="surface empty-customers">
        <Building2 />
        <h2>Ingen kunder ennå</h2>
        <p>
          Legg til den første bedriften manuelt eller hent offentlige
          bedriftsdata fra Brønnøysundregistrene.
        </p>
        <Button onClick={add}>
          <CirclePlus />
          Legg til første kunde
        </Button>
      </section>
    </div>
  );
}

function Nav(p: {
  a: boolean;
  click: () => void;
  ico: React.ReactNode;
  text: string;
  count?: number;
}) {
  return (
    <button aria-current={p.a ? "page" : undefined} className={p.a ? "active" : ""} onClick={p.click} title={p.text} aria-label={p.text}>
      {p.ico}
      <span className="nav-label">{p.text}</span>
      {p.count ? <span className="nav-count">{p.count}</span> : null}
    </button>
  );
}
function Add(p: {
  showTrigger?: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  q: string;
  setQ: (v: string) => void;
  busy: boolean;
  lookup: () => Promise<void>;
  results: Partial<Company>[];
  draft: Partial<Company>;
  setDraft: (v: Partial<Company>) => void;
  save: () => void;
}) {
  const [searched, setSearched] = useState(false),
    [manual, setManual] = useState(false),
    person = p.draft.customerType === "Person",
    showForm = person || manual || Boolean(p.draft.orgNumber);
  const resetSearch = () => {
    setSearched(false);
    setManual(false);
    p.setQ("");
  };
  const setType = (type: string) => {
    p.setDraft({ stage: "Ny kunde", customerType: type });
    resetSearch();
  };
  const search = async () => {
    if (!p.q.trim()) return;
    setManual(false);
    await p.lookup();
    setSearched(true);
  };
  const close = (open: boolean) => {
    p.setOpen(open);
    if (!open) {
      setSearched(false);
      setManual(false);
    }
  };
  const choose = (result: Partial<Company>) => {
    p.setDraft({ ...result, stage: "Ny kunde", customerType: "Bedrift" });
    setManual(true);
  };
  const startManual = () => {
    p.setDraft({
      stage: "Ny kunde",
      customerType: "Bedrift",
      name: p.q,
      source: "Manuelt",
    });
    setManual(true);
  };
  return (
    <>
      {p.showTrigger !== false && (
        <Button className="primary-button" onClick={() => p.setOpen(true)}>
          <CirclePlus />
          Ny kunde
        </Button>
      )}
      <Dialog open={p.open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ny kunde</DialogTitle>
            <DialogDescription>
              Søk etter en bedrift, eller legg inn en privatperson separat.
            </DialogDescription>
          </DialogHeader>
          <div className="customer-type">
            <button
              className={!person ? "active" : ""}
              onClick={() => setType("Bedrift")}
            >
              <Building2 />
              Bedrift
            </button>
            <button
              className={person ? "active" : ""}
              onClick={() => setType("Person")}
            >
              <UserPlus />
              Privatperson
            </button>
          </div>
          {!person && (
            <>
              <div className="lookup-row">
                <Input
                  value={p.q}
                  onChange={(e) => {
                    p.setQ(e.target.value);
                    setSearched(false);
                    setManual(false);
                    p.setDraft({ stage: "Ny kunde", customerType: "Bedrift" });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Firmanavn eller organisasjonsnummer"
                />
                <Button onClick={search} disabled={p.busy}>
                  {p.busy ? "Søker …" : "Søk"}
                </Button>
              </div>
              <p className="form-hint">
                Søket viser bedrifter fra Brønnøysundregistrene.
                Enkeltpersonforetak med personnavn vises ikke.
              </p>
              {p.results.length > 0 && !manual && (
                <div className="lookup-results">
                  {p.results.map((r) => (
                    <button key={r.orgNumber} onClick={() => choose(r)}>
                      <Building2 />
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          Org: {r.orgNumber} · {r.city}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                  <button className="manual-result" onClick={startManual}>
                    <CirclePlus />
                    <span>
                      <strong>Finner du ikke riktig bedrift?</strong>
                      <small>Legg inn bedriften manuelt</small>
                    </span>
                    <ChevronRight />
                  </button>
                </div>
              )}
              {searched && !p.busy && !p.results.length && !manual && (
                <div className="manual-entry">
                  <p>Fant ingen bedrift som matcher søket.</p>
                  <Button variant="outline" onClick={startManual}>
                    <CirclePlus />
                    Legg inn manuelt
                  </Button>
                </div>
              )}
            </>
          )}
          {showForm && (
            <>
              <div className="form-grid">
                <div className="full">
                  <Label>{person ? "Navn *" : "Bedriftsnavn *"}</Label>
                  <Input
                    required
                    aria-required="true"
                    value={p.draft.name ?? ""}
                    onChange={(e) =>
                      p.setDraft({ ...p.draft, name: e.target.value })
                    }
                  />
                </div>
                {!person && (
                  <div className="full">
                    <Label>
                      Organisasjonsnummer <span>(valgfritt)</span>
                    </Label>
                    <Input
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="123 456 789"
                      value={p.draft.orgNumber ?? ""}
                      onChange={(e) =>
                        p.setDraft({ ...p.draft, orgNumber: e.target.value })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label>
                    Telefon <span>(valgfritt)</span>
                  </Label>
                  <Input
                    type="tel"
                    value={p.draft.phone ?? ""}
                    onChange={(e) =>
                      p.setDraft({ ...p.draft, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>
                    E-post <span>(valgfritt)</span>
                  </Label>
                  <Input
                    type="email"
                    value={p.draft.email ?? ""}
                    onChange={(e) =>
                      p.setDraft({ ...p.draft, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button disabled={!p.draft.name?.trim()} onClick={p.save}>
                Legg til kunden
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function Overview(p: {
  displayName: string;
  companies: Company[];
  overdue: Activity[];
  today: Activity[];
  upcoming: Activity[];
  go: (v: View) => void;
  complete: (a: Activity) => void;
  select: (id: number) => void;
}) {
  const tasks = [...p.overdue, ...p.today];
  const recent = [...p.companies].sort((a,b) => (b.lastContactAt || "").localeCompare(a.lastContactAt || "")).slice(0, 6);
  return (
    <div className="page-pad overview-page">
      <section className="welcome">
        <div>
          <p className="eyebrow">DIN ARBEIDSDAG</p>
          <h2>God dag, {p.displayName}.</h2>
          <p>{tasks.length ? `Du har ${tasks.length} ${tasks.length === 1 ? "oppfølging som trenger" : "oppfølginger som trenger"} deg.` : "Alt er fulgt opp. Her er kundene og avtalene dine."}</p>
        </div>
        <Button variant="outline" onClick={() => p.go("followup")}>Se all oppfølging <ChevronRight /></Button>
      </section>
      <div className="metric-grid overview-metrics">
        <Metric label="Kunder" value={p.companies.length} />
        <Metric label="Forfalt" value={p.overdue.length} tone="red" />
        <Metric label="I dag" value={p.today.length} tone="green" />
        <Metric label="Kommende" value={p.upcoming.length} />
      </div>
      <div className="overview-columns">
        <section className="customer-ledger">
          <div className="surface-head"><h3>Kundene dine</h3><Button variant="ghost" onClick={() => p.go("customers")}>Se alle <ChevronRight /></Button></div>
          <p className="form-hint">Sist kontaktet</p>
          {recent.length ? <div className="ledger-list">{recent.map(company => <button key={company.id} className="ledger-row" onClick={() => p.select(company.id)}>
            <span className="company-icon">{company.name.slice(0,1)}</span>
            <span className="ledger-company"><strong>{company.name}</strong><small>{company.city || company.industry || (company.customerType === "Person" ? "Privatperson" : "Bedrift")}</small></span>
            <span className={stageClass[company.stage]}>{company.stage}</span><ChevronRight size={17}/>
          </button>)}</div> : <div className="ledger-empty"><Building2/><p>Kundeboken din er klar.</p><Button variant="outline" onClick={() => p.go("customers")}>Legg til den første kunden</Button></div>}
        </section>
        <aside className="overview-agenda" aria-label="Oppfølginger">
          <h3>Dagens agenda</h3>
          <Group title="Forfalt" items={[...p.overdue].sort((a,b)=>a.dueAt.localeCompare(b.dueAt))} tone="danger" complete={p.complete} select={p.select}/>
          <Group title="I dag" items={[...p.today].sort((a,b)=>a.dueAt.localeCompare(b.dueAt))} tone="today" complete={p.complete} select={p.select}/>
          {!tasks.length && p.upcoming.length > 0 && <Group title="Neste avtaler" items={[...p.upcoming].sort((a,b)=>a.dueAt.localeCompare(b.dueAt)).slice(0,3)} complete={p.complete} select={p.select}/>}
        </aside>
      </div>
    </div>
  );
}

function OfferComposer({
  company,
  contacts,
  organizationId,
  attachments,
  upload,
  uploading,
}: {
  company: Company;
  contacts: Contact[];
  organizationId: number;
  attachments: Attachment[];
  upload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}) {
  const [templates, setTemplates] = useState<OfferTemplate[]>([]),
    [templateId, setTemplateId] = useState("new"),
    [contactId, setContactId] = useState("none"),
    [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]),
    [subject, setSubject] = useState(`Tilbud til ${company.name}`),
    [body, setBody] = useState(
      `Hei,\n\nTakk for hyggelig dialog. Vedlagt følger tilbudet til ${company.name}.\n\nVennlig hilsen`,
    );
  useEffect(() => {
    apiFetch("/api/offers", {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
      })
      .catch(() => undefined);
  }, [organizationId]);
  const effectiveContactId = contacts.some(
      (item) => String(item.id) === contactId,
    )
      ? contactId
      : "none",
    contact = contacts.find((item) => String(item.id) === effectiveContactId),
    contactName = contact?.name || company.contactName || "der",
    email = contact?.email || company.email,
    fill = (value: string) =>
      value
        .replace(/{{\s*bedrift\s*}}/gi, company.name)
        .replace(/{{\s*kontaktperson\s*}}/gi, contactName),
    renderedSubject = fill(subject),
    renderedBody = fill(body);
  useEffect(() => {
    setSelectedAttachmentIds((ids) => [
      ...new Set([...ids, ...attachments.map((file) => file.id)]),
    ]);
  }, [attachments]);
  useEffect(() => {
    setTemplateId("new");
    setSubject(`Tilbud til ${company.name}`);
    setBody(
      `Hei ${contactName},\n\nTakk for hyggelig dialog. Vedlagt følger tilbudet til ${company.name}.\n\nVennlig hilsen`,
    );
  }, [company.id]);
  function selectTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => String(item.id) === id);
    if (template) {
      setSubject(fill(template.subject));
      setBody(fill(template.body));
    }
  }
  return (
    <details className="compact-section offer-section">
      <summary>
        <span>
          <Mail size={18} />
          Tilbud
        </span>
        <strong>Lag tilbud fra mal</strong>
      </summary>
      <div className="compact-body offer-composer">
        <div className="offer-grid">
          <div>
            <Label>Tilbudsmal</Label>
            <Select value={templateId} onValueChange={selectTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Standardtekst</SelectItem>
                {templates.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kontaktperson</Label>
            <Select
              value={effectiveContactId}
              onValueChange={(id) => {
                setContactId(id);
                const next = contacts.find((item) => String(item.id) === id);
                const template = templates.find(
                  (item) => String(item.id) === templateId,
                );
                if (template) {
                  const name = next?.name || company.contactName || "der";
                  setSubject(
                    template.subject
                      .replace(/{{\s*bedrift\s*}}/gi, company.name)
                      .replace(/{{\s*kontaktperson\s*}}/gi, name),
                  );
                  setBody(
                    template.body
                      .replace(/{{\s*bedrift\s*}}/gi, company.name)
                      .replace(/{{\s*kontaktperson\s*}}/gi, name),
                  );
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bedriftens e-post</SelectItem>
                {contacts.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Label>Emne</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Label>E-posttekst</Label>
        <Textarea
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="offer-attachments">
          <Label>Vedlegg</Label>
          {attachments.map(
            (file) =>
              selectedAttachmentIds.includes(file.id) && (
                <div className="offer-file" key={file.id}>
                  <span>{file.filename}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSelectedAttachmentIds((ids) =>
                        ids.filter((id) => id !== file.id),
                      )
                    }
                  >
                    <Trash2 />
                    Fjern
                  </Button>
                </div>
              ),
          )}
          <label className="attachment-upload">
            <Paperclip />
            <span>{uploading ? "Laster opp …" : "Last opp nytt vedlegg"}</span>
            <input type="file" disabled={uploading} onChange={upload} />
          </label>
        </div>
        <EmailSend organizationId={organizationId} companyIds={[company.id]} contactId={contact?.id} attachmentIds={selectedAttachmentIds} subject={renderedSubject} message={renderedBody} recipientLabel={email || "Mottakeren mangler e-postadresse"} />
      </div>
    </details>
  );
}
function Metric(p: { label: string; value: number; tone?: string }) {
  return (
    <div className={`metric ${p.tone ?? ""}`}>
      <span>{p.label}</span>
      <strong>{p.value}</strong>
    </div>
  );
}
function Customers(p: {
  list: Company[];
  selected: Company;
  query: string;
  setQuery: (v: string) => void;
  select: (id: number) => void;
  update: (v: Partial<Company>) => void;
  contact: (k: string) => void;
  refresh?: (c: Company) => void;
  contacts: Contact[];
  selectedContactId: number;
  selectContact: (id: number) => void;
  addContact: () => void;
  history: Activity[];
  removeHistory: (a: Activity) => void;
  attachments: Attachment[];
  upload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  download: (a: Attachment) => void;
  removeAttachment: (a: Attachment) => void;
  organizationId: number;
  add: () => void;
  onFollowupsChanged: () => Promise<void>;
  activityRevision: Activity[];
}) {
  const [openHistory, setOpenHistory] = useState<Activity | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");
  const [savingHistory, setSavingHistory] = useState(false);
  async function saveHistoryNote() {
    if (!openHistory || savingHistory) return;
    setSavingHistory(true);
    try {
      const response = await apiFetch("/api/activities", {method:"PATCH", headers:{"Content-Type":"application/json","x-organization-id":String(p.organizationId)}, body:JSON.stringify({id:openHistory.id,note:historyDraft})});
      const data=await response.json(); if(!response.ok)throw new Error(data.error||"Notatet kunne ikke lagres.");
      setOpenHistory(data.activity);setHistoryDraft(data.activity.note);toast.success("Notatet er lagret");
      await p.onFollowupsChanged();
    } catch(error) { toast.error(error instanceof Error?error.message:"Notatet kunne ikke lagres."); }
    finally { setSavingHistory(false); }
  }
  const c = p.selected,
    currentContacts = p.contacts.filter((x) => x.companyId === c.id),
    person =
      currentContacts.find((x) => x.id === p.selectedContactId) ??
      currentContacts[0],
    isPerson = c.customerType === "Person",
    historyContact = openHistory
      ? p.contacts.find((x) => x.id === openHistory.contactId)
      : null;
  return (
    <section className="content-grid customer-book" aria-label="Kundebok">
      <div className="customer-panel">
        <div className="book-heading"><span className="eyebrow">KUNDEBOK</span><h2>Bedrifter og kontakter</h2></div>
        <div className="customer-search-row">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="Søk etter kunde eller kontakt"
              placeholder="Søk etter kunde eller kontakt …"
              value={p.query}
              onChange={(e) => p.setQuery(e.target.value)}
            />
            {p.query && (
              <button aria-label="Tøm søk" onClick={() => p.setQuery("")}>
                <X size={17} />
              </button>
            )}
          </div>
          <Button onClick={p.add}>
            <CirclePlus />
            Ny kunde
          </Button>
        </div>
        <div className="list-heading">
          <span>
            {p.list.length} {p.list.length === 1 ? "kunde" : "kunder"}
          </span>
        </div>
        <div className="customer-list" aria-label="Kunder">
          {!p.list.length && <p className="empty-list">Ingen kunder passer søket ditt.</p>}
          {p.list.map((x) => (
            <button
              key={x.id}
              aria-pressed={x.id === c.id}
              title={x.name}
              className={
                x.id === c.id ? "customer-row selected" : "customer-row"
              }
              onClick={() => p.select(x.id)}
            >
              <div className="company-icon">{x.name[0]}</div>
              <div className="company-main">
                <strong>{x.name}</strong>
                {x.customerType === "Person" && <span>Privatperson</span>}
                <em className={stageClass[x.stage]}>{x.stage}</em>
              </div>
              <div className="next-date">
                <Clock3 size={15} />
                {followUpLabel(x.nextActionDate)}
              </div>
            </button>
          ))}
        </div>
      </div>
      <article className="detail-panel" aria-label={`Kundekort: ${c.name}`}>
        <div className="detail-head">
          <div className="large-company-icon">{c.name[0]}</div>
          <div>
            <span className={stageClass[c.stage]}>{c.stage}</span>
            <h2>{c.name}</h2>
            <p>
              {isPerson
                ? "Privatperson"
                : c.orgNumber
                  ? `Org: ${c.orgNumber}`
                  : "Organisasjonsnummer mangler"}
            </p>
          </div>
          {!isPerson && (
            <div className="contact-picker">
              <Label>Kontaktperson</Label>
              <div>
                <select
                  value={p.selectedContactId || ""}
                  onChange={(e) => p.selectContact(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Velg ansatt
                  </option>
                  {currentContacts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.title ? ` · ${x.title}` : ""}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={p.addContact}>
                  <UserPlus />
                  Ny ansatt
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="activity-label">Registrer aktivitet</p>
        <div className="contact-actions" role="group" aria-label="Registrer aktivitet">
          {["Telefon", "E-post", "Møte", "Annet"].map((k) => (
            <button key={k} aria-label={`Registrer aktivitet: ${k}`} onClick={() => p.contact(k)}>
              {icon(k)}
              <span>{k}</span>
            </button>
          ))}
        </div>
        <div className="status-row">
          <span>STATUS</span>
          <Select value={c.stage} onValueChange={(v) => p.update({ stage: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="facts">
          <div>
            <span>{isPerson ? "Kunde" : "Valgt kontakt"}</span>
            <strong>{person?.name || c.contactName || c.name}</strong>
          </div>
          <div>
            <span>Telefon</span>
            <strong><PhoneLink phone={person?.phone || c.phone || ""}/></strong>
          </div>
          <div>
            <span>E-post</span>
            <strong>{person?.email || c.email ? <a href={`mailto:${person?.email || c.email}`}>{person?.email || c.email}</a> : "Ikke oppgitt"}</strong>
          </div>
        </div>
        <CustomerFollowups company={c} contacts={currentContacts} organizationId={p.organizationId} onChanged={p.onFollowupsChanged} revision={p.activityRevision}/>
        {!isPerson && (
          <details className="compact-section">
            <summary>
              <span>
                <Building2 size={18} />
                Bedriftsdata
              </span>
              <strong>
                {[c.city, c.employees != null ? `${c.employees} ansatte` : ""]
                  .filter(Boolean)
                  .join(" · ") || "Vis detaljer"}
              </strong>
            </summary>
            <div className="business-grid">
              <div>
                <span>Bransje</span>
                <strong>{c.industry || "Ikke oppgitt"}</strong>
              </div>
              <div>
                <span>Sted</span>
                <strong>{c.city || "Ikke oppgitt"}</strong>
              </div>
              <div>
                <span>Ansatte</span>
                <strong>{c.employees ?? "–"}</strong>
              </div>
              <div>
                <span>Dager siden sist kontakt</span>
                <strong>{daysSince(c.lastContactAt)}</strong>
              </div>
            </div>
          </details>
        )}
        <OfferComposer
          company={c}
          contacts={currentContacts}
          organizationId={p.organizationId}
          attachments={p.attachments}
          upload={p.upload}
          uploading={p.uploading}
        />
        <details className="compact-section">
          <summary><span>Notater</span></summary>
          <div className="compact-body"><Textarea aria-label="Notater" value={c.note} onChange={(e) => p.update({ note: e.target.value })} rows={3}/></div>
        </details>
        <details className="compact-section">
          <summary>
            <span>
              <Paperclip size={18} />
              Vedlegg
            </span>
            <strong>
              {p.attachments.length
                ? `${p.attachments.length} filer`
                : "Ingen vedlegg"}
            </strong>
          </summary>
          <div className="compact-body">
            <label className="attachment-upload">
              <Paperclip />
              <span>{p.uploading ? "Laster opp …" : "Legg til vedlegg"}</span>
              <input
                type="file"
                disabled={p.uploading || c.id < 0}
                onChange={p.upload}
              />
            </label>
            {c.id < 0 && (
              <p className="form-hint">
                Lagre en ekte kunde før du legger til vedlegg.
              </p>
            )}
            <div className="attachment-list">
              {p.attachments.map((a) => (
                <div key={a.id}>
                  <button
                    className="attachment-name"
                    onClick={() => p.download(a)}
                  >
                    <Paperclip />
                    <span>
                      <strong>{a.filename}</strong>
                      <small>
                        {fileSize(a.size)} · {date(a.createdAt, true)}
                      </small>
                    </span>
                  </button>
                  <button
                    className="attachment-delete"
                    title="Slett vedlegg"
                    onClick={() => p.removeAttachment(a)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
        <section>
          <div className="section-label">
            <Clock3 size={18} />
            <span>HISTORIKK</span>
            <small>{p.history.length} hendelser</small>
          </div>
          {p.history.length ? (
            <div className="history-list">
              {p.history.map((a) => {
                const contact = p.contacts.find((x) => x.id === a.contactId);
                return (
                  <button
                    className="history-row"
                    key={a.id}
                    onClick={() => {setOpenHistory(a);setHistoryDraft(a.note || "");}}
                  >
                    <div className="task-kind">{icon(a.kind)}</div>
                    <div>
                      <strong>
                        {a.kind}
                        {contact ? ` · ${contact.name}` : ""}
                      </strong>
                      <p>{a.note || "Ingen notat"}</p>
                      <span>
                        {date(a.completedAt || a.createdAt, true)} · registrert
                        av {a.createdBy}
                      </span>
                    </div>
                    <ChevronRight />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty-line">Ingen hendelser er registrert ennå.</p>
          )}
        </section>
        <Sheet
          open={!!openHistory}
          onOpenChange={(open) => !open && setOpenHistory(null)}
        >
          <SheetContent className="history-sheet sm:max-w-[42vw]">
            <SheetHeader>
              <SheetTitle>{openHistory?.kind}</SheetTitle>
              <SheetDescription>
                {openHistory
                  ? `${date(openHistory.completedAt || openHistory.createdAt, true)} · registrert av ${openHistory.createdBy}`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="history-sheet-body">
              <div>
                <span>Kontaktperson</span>
                <strong>
                  {historyContact?.name || "Ingen kontaktperson valgt"}
                </strong>
              </div>
              <div>
                <span>Notat</span>
                <Textarea aria-label="Rediger notat" rows={8} value={historyDraft} disabled={savingHistory} onChange={event=>setHistoryDraft(event.target.value)} />
                <div className="history-note-actions"><Button disabled={savingHistory || historyDraft === (openHistory?.note || "")} onClick={saveHistoryNote}>{savingHistory?"Lagrer …":"Lagre notat"}</Button><Button variant="outline" disabled={savingHistory} onClick={()=>{setHistoryDraft(openHistory?.note||"");setOpenHistory(null);}}>Avbryt</Button></div>
              </div>
            </div>
            {openHistory && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="history-delete">
                    <Trash2 />
                    Slett hendelsen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Slette denne hendelsen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette kan ikke angres.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        p.removeHistory(openHistory);
                        setOpenHistory(null);
                      }}
                    >
                      Slett
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </SheetContent>
        </Sheet>
      </article>
    </section>
  );
}
function Follow(p: {
  overdue: Activity[];
  today: Activity[];
  upcoming: Activity[];
  none: Company[];
  complete: (a: Activity) => void;
  select: (id: number) => void;
  calendar: () => void;
}) {
  return (
    <div className="page-pad">
      <Group
        title="Forfalt"
        items={p.overdue}
        tone="danger"
        complete={p.complete}
        select={p.select}
      />
      <Group
        title="I dag"
        items={p.today}
        tone="today"
        complete={p.complete}
        select={p.select}
      />
      <Group
        title="Kommende"
        items={p.upcoming}
        complete={p.complete}
        select={p.select}
      />
      <section className="surface compact">
        <div className="surface-head">
          <h3>Ingen oppfølging avtalt</h3>
          <span>{p.none.length}</span>
        </div>
        {p.none.map((c) => (
          <button
            className="plain-row"
            key={c.id}
            onClick={() => p.select(c.id)}
          >
            <div className="company-icon">{c.name[0]}</div>
            <strong>{c.name}</strong>
            <span>Avtal oppfølging</span>
            <ChevronRight />
          </button>
        ))}
      </section>
    </div>
  );
}
function Group(p: {
  title: string;
  items: Activity[];
  tone?: string;
  complete: (a: Activity) => void;
  select: (id: number) => void;
}) {
  return (
    <section className={`surface task-group ${p.tone ?? ""}`}>
      <div className="surface-head">
        <h3>{p.title}</h3>
        <span>{p.items.length}</span>
      </div>
      {p.items.length ? (
        <div className="task-list">
          {p.items.map((a) => (
            <Task
              key={a.id}
              a={a}
              complete={p.complete}
              select={p.select}
            />
          ))}
        </div>
      ) : (
        <p className="empty-line">Ingen oppfølginger her.</p>
      )}
    </section>
  );
}
function Task(p: {
  a: Activity;
  complete: (a: Activity) => void;
  select: (id: number) => void;
}) {
  return (
    <div className="task-row">
      <div className="task-kind">{icon(p.a.kind)}</div>
      <div>
        <button
          type="button"
          className="task-company-link"
          onClick={() => p.select(p.a.companyId)}
        >
          {p.a.companyName}
        </button>
        <span>{p.a.note || p.a.kind}</span>
      </div>
      <time>{date(p.a.dueAt, true)}</time>
      <div className="task-actions">
        <Button
          variant="outline"
          className="complete-button"
          title="Marker oppfølgingen som utført"
          onClick={() => p.complete(p.a)}
        >
          <Check />
          Marker som utført
        </Button>
      </div>
    </div>
  );
}
function Reports(p: {
  companies: Company[];
  activities: Activity[];
  members: Member[];
  role: string;
  currentUser: string;
}) {
  const [period, setPeriod] = useState("week"),
    [employee, setEmployee] = useState(
      p.role === "Bruker" ? p.currentUser : "all",
    ),
    [customFrom, setCustomFrom] = useState(today),
    [customTo, setCustomTo] = useState(today),
    now = new Date(),
    dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    monday = new Date(dayStart);
  monday.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7));
  let from = dayStart,
    to = new Date(dayStart.getTime() + 86400000);
  if (period === "week") {
    from = monday;
    to = new Date(monday.getTime() + 7 * 86400000);
  } else if (period === "previous") {
    from = new Date(monday.getTime() - 7 * 86400000);
    to = monday;
  } else if (period === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear() + 1, 0, 1);
  } else if (period === "custom") {
    from = new Date(`${customFrom}T00:00:00`);
    to = new Date(`${customTo}T23:59:59`);
  }
  const inside = (v?: string) =>
      !!v && new Date(v) >= from && new Date(v) <= to,
    own = (name?: string) => employee === "all" || name === employee,
    companies = p.companies.filter(
      (c) => inside(c.createdAt) && own(c.assignedTo),
    ),
    activities = p.activities.filter(
      (a) => inside(a.completedAt || a.createdAt) && own(a.createdBy),
    ),
    vals = [
      companies.length,
      new Set(activities.filter((a) => a.completedAt).map((a) => a.companyId))
        .size,
      activities.filter((a) => a.kind === "Møte" && a.completedAt).length,
      p.activities.filter(
        (a) =>
          a.kind === "Møte" &&
          !a.completedAt &&
          inside(a.createdAt) &&
          own(a.createdBy),
      ).length,
      companies.filter((c) => c.stage === "Tilbud sendt").length,
      companies.filter((c) => c.stage === "Vunnet").length,
      companies.filter((c) => c.stage === "Tapt").length,
    ],
    labels = [
      "Nye kunder",
      "Kunder kontaktet",
      "Møter gjennomført",
      "Møter booket",
      "Tilbud sendt",
      "Kunder vunnet",
      "Kunder tapt",
    ],
    max = Math.max(1, ...vals),
    people = [...new Set(activities.map((a) => a.createdBy))];
  return (
    <div className="page-pad">
      <div className="report-filter">
        {p.role !== "Bruker" && (
          <Select value={employee} onValueChange={setEmployee}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle ansatte</SelectItem>
              {p.members
                .filter((member) => member.active)
                .map((member) => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">I dag</SelectItem>
            <SelectItem value="week">Denne uken</SelectItem>
            <SelectItem value="previous">Forrige uke</SelectItem>
            <SelectItem value="year">I år</SelectItem>
            <SelectItem value="custom">Valgfri datointervall</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <div>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span>til</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>
      <section className="surface report">
        <div className="surface-head">
          <div>
            <p className="eyebrow">VALGT PERIODE</p>
            <h3>Aktivitet og resultater</h3>
          </div>
        </div>
        <div className="report-rows">
          {labels.map((l, i) => (
            <div key={l}>
              <span>{l}</span>
              <div className="bar-track">
                <i
                  style={{ width: `${Math.max(4, (vals[i] / max) * 100)}%` }}
                />
              </div>
              <strong>{vals[i]}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="metric-grid">
        <Metric
          label="Uten neste aktivitet"
          value={
            p.companies.filter((c) => !c.nextActionDate && own(c.assignedTo))
              .length
          }
          tone="red"
        />
        <Metric
          label="Tilbud sendt"
          value={
            p.companies.filter(
              (c) => c.stage === "Tilbud sendt" && own(c.assignedTo),
            ).length
          }
        />
        <Metric label="Kunder tapt" value={vals[6]} tone="red" />
        <Metric
          label="Aktiviteter registrert"
          value={activities.filter((a) => a.completedAt).length}
          tone="green"
        />
      </div>
      <section className="surface">
        <div className="surface-head">
          <h3>Aktivitet per medarbeider</h3>
        </div>
        {people.length ? (
          people.map((n) => (
            <div className="performance-row" key={n}>
              <div className="avatar">{n.slice(0, 2).toUpperCase()}</div>
              <strong>{n}</strong>
              <span>
                {activities.filter((a) => a.createdBy === n).length} aktiviteter
              </span>
            </div>
          ))
        ) : (
          <p className="empty-line">Ingen aktiviteter i perioden.</p>
        )}
      </section>
    </div>
  );
}
function Admin(p: {
  members: Member[];
  role: string;
  userEmail: string;
  supportAccess: boolean;
  support: (v: boolean) => void;
  supportRequests: SupportRequest[];
  approveSupport: (id: number) => void;
  readExcel: (e: ChangeEvent<HTMLInputElement>) => void;
  rows: Partial<Company>[];
  importName: string;
  doImport: () => void;
  newMember: { name: string; email: string; role: string };
  setNewMember: (v: { name: string; email: string; role: string }) => void;
  addMember: () => void;
  setMemberStatus: (member: Member, active: boolean) => void;
  companies: Company[];
  refresh: (c: Company) => void;
  organizations: Organization[];
  activeOrgId: number;
  switchOrg: (id: number) => void;
  exportBackup: () => void;
}) {
  return (
    <div className="page-pad admin-grid">

      {p.role !== "Bruker" && (
        <OfferTemplateManager organizationId={p.activeOrgId} />
      )}
      <AdminCard
        eye="KUNDEIMPORT"
        title="Importer fra Excel"
        ico={<FileSpreadsheet />}
      >
        <p>
          Vi finner automatisk bedrift, kontakt, telefon, e-post og notater.
        </p>
        <label className="upload-box">
          <Upload />
          <strong>{p.importName || "Velg Excel-fil"}</strong>
          <span>.xlsx, .xls eller .csv · maks 500 kunder</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={p.readExcel} />
        </label>
        {p.rows.length > 0 && (
          <div className="import-preview">
            <strong>{p.rows.length} kunder klare</strong>
            <span>
              {p.rows
                .slice(0, 3)
                .map((r) => r.name)
                .join(", ")}
            </span>
            <Button onClick={p.doImport}>Importer kundene</Button>
          </div>
        )}
      </AdminCard>
      <AdminCard
        eye="SIKKERHETSKOPI"
        title="Eksporter alle data"
        ico={<Download />}
      >
        <p>Last ned kunder, kontaktpersoner og historikk som en Excel-fil.</p>
        <Button variant="outline" onClick={p.exportBackup}>
          <Download />
          Last ned sikkerhetskopi
        </Button>
      </AdminCard>
      <AdminCard eye="TILGANG" title="Brukere og roller" ico={<UserPlus />}>
        <div className="member-list">
          {p.members.map((m) => (
            <div key={m.id}>
              <div className="avatar">{m.name.slice(0, 2).toUpperCase()}</div>
              <span>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </span>
              {m.scheduledDisableAt && <small>Deaktiveres {date(m.scheduledDisableAt,true)}</small>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => p.setMemberStatus(m, m.scheduledDisableAt ? true : !m.active)}
              >
                {m.scheduledDisableAt ? "Avbryt deaktivering" : m.active ? "Deaktiver" : "Aktiver"}
              </Button>
            </div>
          ))}
        </div>
        <div className="member-form">
          <Input
            placeholder="Navn"
            value={p.newMember.name}
            onChange={(e) =>
              p.setNewMember({ ...p.newMember, name: e.target.value })
            }
          />
          <Input
            placeholder="E-post"
            value={p.newMember.email}
            onChange={(e) =>
              p.setNewMember({ ...p.newMember, email: e.target.value })
            }
          />
          <Select
            value={p.newMember.role}
            onValueChange={(role) => p.setNewMember({ ...p.newMember, role })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bruker">Bruker</SelectItem>
              <SelectItem value="Administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={p.addMember}>Aktiver</Button>
        </div>
      </AdminCard>
      <AdminCard
        eye="SUPPORT"
        title="Trygg supporttilgang"
        ico={<Headphones />}
      >
        <p>
          Serviceteamet kan åpne organisasjonen i 24 timer. Alle endringer
          loggføres.
        </p>
        {p.supportRequests.map((r) => (
          <div className="support-request" key={r.id}>
            <div>
              <strong>Support ber om midlertidig tilgang</strong>
              <span>
                Sendt av {r.requestedBy} · {date(r.createdAt, true)}
              </span>
            </div>
            <Button onClick={() => p.approveSupport(r.id)}>
              Godkjenn i 24 timer
            </Button>
          </div>
        ))}
        <div className="setting-row">
          <div>
            <strong>Gi support tilgang</strong>
            <span>
              {p.supportAccess ? "Utløper om 24 timer" : "Ingen har tilgang"}
            </span>
          </div>
          <Switch checked={p.supportAccess} onCheckedChange={p.support} />
        </div>
      </AdminCard>
    </div>
  );
}
function BulkEmail({ companies, organizationId }: { companies: Company[]; organizationId: number }) {
  const [files,setFiles]=useState<File[]>([]);
  const [segment, setSegment] = useState("all"),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    targets = companies.filter((c) => {
      if (!c.email) return false;
      if (segment === "all") return true;
      if (segment === "active")
        return ["Kontaktet", "Møte avtalt", "Tilbud sendt"].includes(c.stage);
      return c.stage === segment;
    }),
    emails = [
      ...new Set(
        targets.map((c) => c.email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
  return (
    <AdminCard
      title="Send e-post til kunder"
      ico={<Mail />}
    >
      <div className="bulk-email">
        <div>
          <Label>Kundegruppe</Label>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kunder</SelectItem>
              <SelectItem value="Ny kunde">Nye kunder</SelectItem>
              <SelectItem value="active">Kunder under oppfølging</SelectItem>
              <SelectItem value="Vunnet">Vunnede kunder</SelectItem>
              <SelectItem value="Tapt">Tapte kunder</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Emne</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Skriv emne"
          />
        </div>
        <div className="full">
          <Label>Melding</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Skriv meldingen …"
          />
        </div>
        <div className="full email-attachments">
          <Label htmlFor="bulk-email-files">Vedlegg</Label>
          <Input id="bulk-email-files" type="file" multiple onChange={event=>{const next=[...files,...Array.from(event.target.files??[])];event.target.value="";if(next.length>10||next.reduce((sum,f)=>sum+f.size,0)>10*1024*1024)return toast.error("Maks 10 vedlegg og 10 MB samlet.");setFiles(next);}} />
          {files.map((file,index)=><div className="offer-file" key={`${file.name}-${index}`}><span>{file.name} · {fileSize(file.size)}</span><Button size="sm" variant="ghost" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X/>Fjern</Button></div>)}
          <p className="form-hint">Maks 10 vedlegg, 10 MB samlet og 49 mottakere per utsending.</p>
        </div>
        <div className="bulk-email-foot">
          <span>{emails.length} mottakere med e-postadresse</span>
          <EmailSend organizationId={organizationId} companyIds={targets.map(c=>c.id)} files={files} subject={subject} message={message} bulk recipientLabel={`${emails.length} mottakere · ${segment === "all"?"Alle kunder":segment}`} />
        </div>
      </div>

    </AdminCard>
  );
}
function OfferTemplateManager({ organizationId }: { organizationId: number }) {
  const blank = {
    id: 0,
    name: "",
    subject: "Tilbud til {{bedrift}}",
    body: "Hei {{kontaktperson}},\n\nHer kommer tilbudet til {{bedrift}}.\n\nVennlig hilsen",
  };
  const [templates, setTemplates] = useState<OfferTemplate[]>([]),
    [draft, setDraft] = useState(blank);
  useEffect(() => {
    apiFetch("/api/offers", {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => undefined);
  }, [organizationId]);
  async function save() {
    if (!draft.name.trim()) return toast.error("Gi malen et navn");
    const r = await apiFetch("/api/offers", {
        method: draft.id ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
          "x-organization-id": String(organizationId),
        },
        body: JSON.stringify(draft),
      }),
      d = await r.json();
    if (!r.ok) return toast.error(d.error ?? "Kunne ikke lagre malen");
    setTemplates((rows) =>
      draft.id
        ? rows.map((row) => (row.id === draft.id ? d.template : row))
        : [d.template, ...rows],
    );
    setDraft(blank);
    toast.success("Tilbudsmalen er lagret");
  }
  async function remove(id: number) {
    const r = await apiFetch(`/api/offers?id=${id}`, {
      method: "DELETE",
      headers: { "x-organization-id": String(organizationId) },
    });
    if (!r.ok) return toast.error("Kunne ikke slette malen");
    setTemplates((rows) => rows.filter((row) => row.id !== id));
    if (draft.id === id) setDraft(blank);
    toast.success("Tilbudsmalen er slettet");
  }
  return (
    <AdminCard eye="KUN FOR ADMINISTRATOR" title="Tilbudsmaler" ico={<Mail />}>
      <p>Lag og vedlikehold malene som brukes på kundekortet.</p>
      <div className="template-list">
        {templates.map((template) => (
          <div key={template.id}>
            <button onClick={() => setDraft(template)}>
              <strong>{template.name}</strong>
              <small>{template.subject}</small>
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => remove(template.id)}
            >
              <Trash2 />
              Slett
            </Button>
          </div>
        ))}
      </div>
      <div className="template-editor">
        <Label>Navn på mal</Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Label>Emne</Label>
        <Input
          value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        />
        <Label>E-posttekst</Label>
        <Textarea
          rows={7}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <p className="form-hint">
          Bruk {"{{bedrift}}"} og {"{{kontaktperson}}"}. Verdiene fylles inn før
          sending.
        </p>
        <div>
          <Button onClick={save}>
            {draft.id ? "Lagre endringer" : "Opprett mal"}
          </Button>
          {draft.id ? (
            <Button variant="outline" onClick={() => setDraft(blank)}>
              Avbryt
            </Button>
          ) : null}
        </div>
      </div>
    </AdminCard>
  );
}
const statusesForHistory = [
  "Ringte – ikke svar",
  "Kontaktet",
  "Møte booket",
  "Tilbud sendt",
  "Ikke aktuell",
  "Lagt til som kunde",
];
function SearchPicker({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false),
    selected = options.find((item) => item.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="search-picker"
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="search-picker-popover">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Ingen treff.</CommandEmpty>
            <CommandGroup>
              {options.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.value}`}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={item.value === value ? "visible" : "invisible"}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
function MultiSearchPicker({
  values,
  onChange,
  options,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const featuredOptions = ["AS", "ENK"]
    .map((value) => options.find((item) => item.value === value))
    .filter((item): item is { value: string; label: string } => Boolean(item));
  const remainingOptions = options.filter(
    (item) => item.value !== "AS" && item.value !== "ENK",
  );
  const label =
    values.length === 0
      ? "Velg organisasjonsformer"
      : values.length === 1
        ? (options.find((item) => item.value === values[0])?.label ?? values[0])
        : `${values.length} organisasjonsformer valgt`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="search-picker"
        >
          {label}
          <ChevronsUpDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="search-picker-popover">
        <Command>
          <CommandInput placeholder="Søk etter organisasjonsform" />
          <CommandList>
            <CommandEmpty>Ingen treff.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Alle organisasjonsformer"
                onSelect={() =>
                  onChange(
                    values.length === options.length
                      ? []
                      : options.map((item) => item.value),
                  )
                }
              >
                <Check
                  className={
                    values.length === options.length && options.length
                      ? "visible"
                      : "invisible"
                  }
                />
                Alle organisasjonsformer
              </CommandItem>
              {featuredOptions.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.value}`}
                  onSelect={() =>
                    onChange(
                      values.includes(item.value)
                        ? values.filter((value) => value !== item.value)
                        : [...values, item.value],
                    )
                  }
                >
                  <Check
                    className={
                      values.includes(item.value) ? "visible" : "invisible"
                    }
                  />
                  {item.label}
                </CommandItem>
              ))}
              <CommandSeparator />
              {remainingOptions.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.value}`}
                  onSelect={() =>
                    onChange(
                      values.includes(item.value)
                        ? values.filter((value) => value !== item.value)
                        : [...values, item.value],
                    )
                  }
                >
                  <Check
                    className={
                      values.includes(item.value) ? "visible" : "invisible"
                    }
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
function CallLists({
  agreedPrice,
  active,
  role,
  members,
  organizationId,
  currentMembershipId,
  onActivated,
  onDataChanged,
  onGoToCustomer,
}: {
  agreedPrice: number | null;
  active: boolean;
  role: string;
  members: Member[];
  organizationId: number;
  currentMembershipId: number;
  onActivated: (enabled: boolean) => void;
  onDataChanged: () => Promise<void>;
  onGoToCustomer: (company: Company) => void;
}) {
  const [unitPrice,setUnitPrice] = useState(agreedPrice);
  const [purchaseBusy,setPurchaseBusy] = useState(false);
  useEffect(()=>setUnitPrice(agreedPrice),[agreedPrice]);
  const initialCache = callListCache.get(organizationId);
  const [entries, setEntries] = useState<CallListEntry[]>(
      initialCache?.entries ?? [],
    ),
    [history, setHistory] = useState<CallListEntry[]>([]),
    [historyLoaded, setHistoryLoaded] = useState(false),
    [historyQuery, setHistoryQuery] = useState(""),
    [meetingEntry, setMeetingEntry] = useState<CallListEntry | null>(null),
    [offerEntry, setOfferEntry] = useState<CallListEntry | null>(null),
    [createdCustomer, setCreatedCustomer] = useState<Company | null>(null),
    [bookedCustomer, setBookedCustomer] = useState<Company | null>(null),
    [meetingSaving, setMeetingSaving] = useState(false),
    [customerChoice, setCustomerChoice] = useState<{
      name: string;
      company: Company | null;
      saving: boolean;
      goWhenReady: boolean;
    } | null>(null),
    [meeting, setMeeting] = useState({
      meetingAt: "",
        meetingNote: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    }),
    [busy, setBusy] = useState(false),
    [loadingEntries, setLoadingEntries] = useState(active && !initialCache),
    [purchaseOpen, setPurchaseOpen] = useState(false),
    [licensedMemberIds, setLicensedMemberIds] = useState<number[]>([]),
    [options, setOptions] = useState<CallListOptions>(
      initialCache?.options ?? {
        municipalities: [],
        industries: [],
        organizationForms: organizationFormFallbackOptions,
      },
    ),
    [filters, setFilters] = useState({
      minEmployees: 1,
      maxEmployees: 30,
      municipalityCode: "all",
      industryCode: "all",
      count: 50,
      requirePhone: false,
      requireEmail: false,
      organizationForms: ["AS"],
    });
  useEffect(() => {
    let cancelled = false;
    if (active) {
      const cached = callListCache.get(organizationId);
      if (!cached) setLoadingEntries(true);
      loadCallListInitial(organizationId)
        .then((data) => {
          if (cancelled) return;
          setEntries(data.entries);
          setOptions(data.options);
        })
        .catch((error) => {
          if (!cancelled)
            toast.error(
              error instanceof Error
                ? error.message
                : "Kunne ikke hente ringelisten",
            );
        })
        .finally(() => setLoadingEntries(false));
    } else setLoadingEntries(false);
    return () => {
      cancelled = true;
    };
  }, [active, organizationId]);
  useEffect(() => {
    if (!active || loadingEntries || !options.organizationForms.length) return;
    callListCache.set(organizationId, {
      entries,
      options,
      loadedAt: Date.now(),
    });
  }, [active, entries, loadingEntries, options, organizationId]);
  useEffect(() => {
    if (!purchaseOpen || role === "Bruker") return;
    apiFetch("/api/admin", {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((r) => r.json())
      .then((admin) => {
        setLicensedMemberIds(admin.modules?.ringelister?.licensedMemberIds ?? []);
        setUnitPrice(admin.pricing?.ringPrice ?? null);
      })
      .catch(() => undefined);
  }, [purchaseOpen, role, organizationId]);
  async function activate() {
    if (purchaseBusy) return;
    if (unitPrice == null) return toast.error("Pris er ikke avtalt. Kontakt Noracre.");
    if (!licensedMemberIds.length) return toast.error("Velg minst én bruker");
    setPurchaseBusy(true);
    try {
      const r = await apiFetch("/api/admin", {method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"moduleStatus",moduleKey:"ringelister",membershipIds:licensedMemberIds,acceptedPrice:unitPrice})});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Kunne ikke aktivere modulen");
      onActivated(Boolean(d.currentUserActive));
      setPurchaseOpen(false);
      toast.success("Modullisensene er oppdatert");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kunne ikke aktivere modulen"); }
    finally { setPurchaseBusy(false); }
  }

  async function generate() {
    setBusy(true);
    try {
      const r = await apiFetch("/api/call-lists", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-organization-id": String(organizationId),
          },
          body: JSON.stringify({
            type: "generate",
            ...filters,
            municipalityCode:
              filters.municipalityCode === "all"
                ? ""
                : filters.municipalityCode,
            industryCode:
              filters.industryCode === "all" ? "" : filters.industryCode,
          }),
        }),
        d = await r.json();
      if (!r.ok) return toast.error(d.error ?? "Kunne ikke lage ringelisten");
      setEntries(d.entries ?? []);
      callListCache.set(organizationId, {
        entries: d.entries ?? [],
        options,
        loadedAt: Date.now(),
      });
      toast.success(`Ny ringeliste med ${d.added ?? 0} bedrifter er klar`);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Importfilen kan være maks 5 MB.");
    const book = XLSX.read(await file.arrayBuffer(), { sheetRows: 501, sheets: 0 }),
      raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
        { defval: "" },
      ),
      pick = (row: Record<string, unknown>, ...keys: string[]) => {
        const key = Object.keys(row).find((item) =>
          keys.some((term) => item.toLowerCase().includes(term)),
        );
        return key ? String(row[key]) : "";
      },
      rows = raw
        .slice(0, 1000)
        .map((row) => ({
          name: pick(row, "bedrift", "firmanavn", "company", "navn"),
          orgNumber: pick(row, "org"),
          industry: pick(row, "bransje", "industry"),
          city: pick(row, "sted", "by", "city"),
          employees: Number(pick(row, "ansatt", "employee")) || null,
          phone: pick(row, "telefon", "mobil", "phone"),
          email: pick(row, "e-post", "epost", "email"),
          website: pick(row, "nettside", "website"),
        }))
        .filter((row) => row.name);
    const r = await apiFetch("/api/call-lists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organization-id": String(organizationId),
        },
        body: JSON.stringify({ type: "import", rows }),
      }),
      d = await r.json();
    if (!r.ok)
      return toast.error(d.error ?? "Kunne ikke importere ringelisten");
    setEntries((current) => [...(d.entries ?? []), ...current]);
    toast.success(`${d.added} bedrifter ble importert`);
  }
  async function loadHistory() {
    if (historyLoaded) return;
    const d = await apiFetch("/api/call-lists?view=history", {
      headers: { "x-organization-id": String(organizationId) },
    }).then((r) => r.json());
    setHistory(d.entries ?? []);
    setHistoryLoaded(true);
  }
  async function saveStatus(
    row: CallListEntry,
    status: string,
    extra: Record<string, string> = {},
  ) {
    const r = await apiFetch("/api/call-lists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organization-id": String(organizationId),
        },
        body: JSON.stringify({ type: "status", id: row.id, status, ...extra }),
      }),
      d = await r.json();
    if (!r.ok) {
      toast.error(d.error ?? "Kunne ikke oppdatere bedriften");
      return null;
    }
    setEntries((rows) => rows.filter((item) => item.id !== row.id));
    setHistory((rows) => [
      d.entry,
      ...rows.filter((item) => item.id !== row.id),
    ]);
    if (
      status === "Møte booket" ||
      status === "Tilbud sendt" ||
      status === "Lagt til som kunde"
    )
      void onDataChanged();
    if (status === "Møte booket")
      toast.success("Møtet er lagt til under kunder og oppfølging");
    return d;
  }
  function update(row: CallListEntry, status: string) {
    if (status === "Møte booket") {
      setMeetingEntry(row);
      setMeeting({
        meetingAt: "",
        meetingNote: "",
        contactName: row.contactName ?? "",
        contactEmail: row.contactEmail ?? row.email ?? "",
        contactPhone: row.contactPhone ?? row.phone ?? "",
      });
      return;
    }
    if (status === "Tilbud sendt") {
      setOfferEntry(row);
      setMeeting({
        meetingAt: "",
        meetingNote: "",
        contactName: row.contactName ?? "",
        contactEmail: row.contactEmail ?? row.email ?? "",
        contactPhone: row.contactPhone ?? row.phone ?? "",
      });
      return;
    }
    if (status === "Lagt til som kunde") {
      void addCustomer(row);
      return;
    }
    void saveStatus(row, status);
  }
  async function addCustomer(row: CallListEntry) {
    setEntries((rows) => rows.filter((item) => item.id !== row.id));
    setCustomerChoice({
      name: row.name,
      company: null,
      saving: true,
      goWhenReady: false,
    });
    const r = await apiFetch("/api/call-lists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organization-id": String(organizationId),
        },
        body: JSON.stringify({ type: "addCustomer", id: row.id }),
      }),
      d = await r.json();
    if (!r.ok) {
      setEntries((rows) => [row, ...rows]);
      setCustomerChoice(null);
      return toast.error(d.error ?? "Kunne ikke legge til kunden");
    }
    setHistory((rows) => [d.entry, ...rows]);
    setCustomerChoice((choice) => {
      if (choice?.goWhenReady && d.company) {
        onGoToCustomer(d.company);
        return null;
      }
      return choice
        ? { ...choice, company: d.company ?? null, saving: false }
        : null;
    });
    void onDataChanged();
  }
  if (!active)
    return (
      <div className="page-pad">
        <section className="surface module-lock">
          <Phone />
          <p className="eyebrow">TILLEGGSMODUL</p>
          <h2>Ringelister</h2>
          <p>
            Lag målrettede ringelister fra Brønnøysundregistrene eller importer
            lister du allerede har kjøpt.
          </p>
          <strong>{unitPrice == null ? "Kontakt Noracre for avtalt pris" : `${unitPrice} kr per valgt bruker per måned eks. mva.`}</strong>
          {role !== "Bruker" ? (
            <Button disabled={unitPrice == null} onClick={() => setPurchaseOpen(true)}>
              Velg brukere og aktiver
            </Button>
          ) : (
            <p>Be administratoren i bedriften aktivere modulen.</p>
          )}
        </section>
        <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Aktiver Ringelister</DialogTitle>
              <DialogDescription>
                Velg hvilke ansatte som skal ha modulen. Avtalt pris er {unitPrice} kr per bruker per måned eks. mva.
              </DialogDescription>
            </DialogHeader>
            <div className="module-member-list">
              <div className="module-member-all">
                <strong>Aktive brukere</strong>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = members
                      .filter((member) => member.active)
                      .map((member) => member.id);
                    setLicensedMemberIds(
                      licensedMemberIds.length === all.length ? [] : all,
                    );
                  }}
                >
                  Alle
                </Button>
              </div>
              {members
                .filter((member) => member.active)
                .map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      checked={licensedMemberIds.includes(member.id)}
                      onChange={(e) =>
                        setLicensedMemberIds((ids) =>
                          e.target.checked
                            ? [...ids, member.id]
                            : ids.filter((id) => id !== member.id),
                        )
                      }
                    />
                    <span>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </span>
                  </label>
                ))}
            </div>
            <div className="module-purchase-total">
              <span>
                {licensedMemberIds.length}{" "}
                {licensedMemberIds.length === 1 ? "bruker" : "brukere"}
              </span>
              <strong>{unitPrice == null ? "Pris ikke avtalt" : `${licensedMemberIds.length * unitPrice} kr/mnd.`}</strong>
            </div>
            <Button onClick={activate} disabled={purchaseBusy || unitPrice == null || !licensedMemberIds.length}>
              Bekreft kjøp og aktiver
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  return (
    <div className="page-pad call-lists">
      <section className="surface">
        <div className="operations-head">
          <div>
            <p className="eyebrow">RINGELISTER</p>
            <h3>Lag en målrettet liste</h3>
          </div>
          <div className="offer-actions">
            {role !== "Bruker" && (
              <Button variant="outline" onClick={() => setPurchaseOpen(true)}>
                <UsersRound />
                Administrer brukere
              </Button>
            )}
            <label className="import-button">
              <Upload size={18} />
              Importer egen liste
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={importFile}
              />
            </label>
          </div>
        </div>
        <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Ringelister for ansatte</DialogTitle>
              <DialogDescription>
                Velg hvem som skal ha modulen. Prisen oppdateres når du lagrer.
              </DialogDescription>
            </DialogHeader>
            <div className="module-member-list">
              <div className="module-member-all">
                <strong>Aktive brukere</strong>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = members
                      .filter((member) => member.active)
                      .map((member) => member.id);
                    setLicensedMemberIds(
                      licensedMemberIds.length === all.length ? [] : all,
                    );
                  }}
                >
                  Alle
                </Button>
              </div>
              {members
                .filter((member) => member.active)
                .map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      checked={licensedMemberIds.includes(member.id)}
                      onChange={(e) =>
                        setLicensedMemberIds((ids) =>
                          e.target.checked
                            ? [...ids, member.id]
                            : ids.filter((id) => id !== member.id),
                        )
                      }
                    />
                    <span>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </span>
                  </label>
                ))}
            </div>
            <div className="module-purchase-total">
              <span>
                {licensedMemberIds.length}{" "}
                {licensedMemberIds.length === 1 ? "bruker" : "brukere"}
              </span>
              <strong>{unitPrice == null ? "Pris ikke avtalt" : `${licensedMemberIds.length * unitPrice} kr/mnd.`}</strong>
            </div>
            <Button onClick={activate} disabled={purchaseBusy || unitPrice == null || !licensedMemberIds.length}>
              Lagre og bekreft pris
            </Button>
          </DialogContent>
        </Dialog>
        <div className="call-filter-grid">
          <div>
            <Label>Min. ansatte</Label>
            <Input
              type="number"
              min="1"
              value={filters.minEmployees}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setFilters({ ...filters, minEmployees: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Maks ansatte</Label>
            <Input
              type="number"
              min="1"
              value={filters.maxEmployees}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setFilters({ ...filters, maxEmployees: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Sted</Label>
            <SearchPicker
              value={filters.municipalityCode}
              onChange={(value) =>
                setFilters({ ...filters, municipalityCode: value })
              }
              options={[
                { value: "all", label: "Hele Norge" },
                ...options.municipalities,
              ]}
              placeholder="Søk etter sted"
            />
          </div>
          <div>
            <Label>Bransje</Label>
            <SearchPicker
              value={filters.industryCode}
              onChange={(value) =>
                setFilters({ ...filters, industryCode: value })
              }
              options={[
                { value: "all", label: "Alle bransjer" },
                ...options.industries,
              ]}
              placeholder="Søk etter bransje"
            />
          </div>
          <div>
            <Label>Antall</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={filters.count}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setFilters({ ...filters, count: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Organisasjonsform</Label>
            <MultiSearchPicker
              values={filters.organizationForms}
              onChange={(organizationForms) =>
                setFilters({ ...filters, organizationForms })
              }
              options={options.organizationForms}
            />
          </div>
        </div>
        <div className="contact-requirements">
          <label>
            <input
              type="checkbox"
              checked={filters.requirePhone}
              onChange={(e) =>
                setFilters({ ...filters, requirePhone: e.target.checked })
              }
            />
            Må ha telefonnummer
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.requireEmail}
              onChange={(e) =>
                setFilters({ ...filters, requireEmail: e.target.checked })
              }
            />
            Må ha e-postadresse
          </label>
          <Button onClick={generate} disabled={busy}>
            <Search />
            {busy ? "Lager liste …" : "Generer ringeliste"}
          </Button>
        </div>
      </section>
      <section className="surface">
        <Tabs
          defaultValue="queue"
          onValueChange={(value) => {
            if (value === "history") void loadHistory();
          }}
        >
          <TabsList>
            <TabsTrigger value="queue">
              Ringeliste ({entries.length})
            </TabsTrigger>
            <TabsTrigger value="history">Historikk</TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
            {loadingEntries ? (
              <div className="list-skeleton">
                <i />
                <i />
                <i />
              </div>
            ) : entries.length ? (
              <ProspectRows rows={entries} update={update} />
            ) : (
              <p className="empty-line">Ingen bedrifter i listen ennå.</p>
            )}
          </TabsContent>
          <TabsContent value="history">
            <div className="history-search">
              <Search />
              <Input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Søk i bedrift, status eller medarbeider"
              />
            </div>
            {historyLoaded ? (
              statusesForHistory.map((status) => {
                const rows = history.filter(
                  (row) =>
                    row.status === status &&
                    `${row.name} ${row.city} ${row.handledBy}`
                      .toLowerCase()
                      .includes(historyQuery.toLowerCase()),
                );
                return rows.length ? (
                  <details className="history-group" key={status}>
                    <summary>
                      <strong>{status}</strong>
                      <span>{rows.length}</span>
                      <ChevronRight />
                    </summary>
                    <ProspectRows rows={rows} update={update} />
                  </details>
                ) : null;
              })
            ) : (
              <p className="empty-line">Henter historikk …</p>
            )}
          </TabsContent>
        </Tabs>
      </section>
      <Dialog
        open={Boolean(meetingEntry)}
        onOpenChange={(open) => {
          if (!open && !meetingSaving) setMeetingEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book møte</DialogTitle>
            <DialogDescription>
              Bedriften legges samtidig til under Kunder.
            </DialogDescription>
          </DialogHeader>
          <div className="meeting-form">
            <Label>Dato og tidspunkt</Label>
            <DateTimePicker label="Møtetidspunkt" value={meeting.meetingAt} onChange={value => setMeeting({ ...meeting, meetingAt: value })}/>
            <Label>Kontaktperson</Label>
            <Input
              value={meeting.contactName}
              onChange={(e) =>
                setMeeting({ ...meeting, contactName: e.target.value })
              }
              placeholder="Navn"
            />
            <Label>E-post</Label>
            <Input
              value={meeting.contactEmail}
              onChange={(e) =>
                setMeeting({ ...meeting, contactEmail: e.target.value })
              }
            />
            <Label>Telefon</Label>
            <Input
              value={meeting.contactPhone}
              onChange={(e) =>
                setMeeting({ ...meeting, contactPhone: e.target.value })
              }
            />
            <Label htmlFor="call-meeting-note">Hva skal møtet handle om?</Label>
            <Textarea id="call-meeting-note" value={meeting.meetingNote} maxLength={5000} rows={3} placeholder="Tema, behov og det dere skal snakke om …" onChange={e=>setMeeting({...meeting,meetingNote:e.target.value})}/>
            <Button disabled={meetingSaving || !meeting.meetingAt}
              onClick={async () => {
                if (!meetingEntry || meetingSaving) return;
                setMeetingSaving(true);
                try {
                  const result=await saveStatus(meetingEntry, "Møte booket", meeting);
                  if(!result?.company)return;
                  setMeetingEntry(null);
                  setBookedCustomer(result.company);
                } catch { toast.error("Møtet kunne ikke lagres. Prøv igjen."); }
                finally { setMeetingSaving(false); }
              }}
            >{meetingSaving?"Lagrer møte …":"Lagre møte"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(bookedCustomer)} onOpenChange={open=>{if(!open)setBookedCustomer(null);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Møtet er opprettet</DialogTitle><DialogDescription>Møtet med {bookedCustomer?.name} er lagret. Hva vil du gjøre videre?</DialogDescription></DialogHeader>
          <div className="offer-actions"><Button variant="outline" onClick={()=>setBookedCustomer(null)}>Fortsett her</Button><Button onClick={()=>{if(bookedCustomer)onGoToCustomer(bookedCustomer);setBookedCustomer(null);}}>Gå til kundekortet</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(offerEntry)}
        onOpenChange={(open) => {
          if (!open) setOfferEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrer sendt tilbud</DialogTitle>
            <DialogDescription>
              Kundekortet opprettes med kontaktinformasjonen du legger inn.
            </DialogDescription>
          </DialogHeader>
          <div className="meeting-form">
            <Label>Kontaktperson</Label>
            <Input
              value={meeting.contactName}
              onChange={(e) =>
                setMeeting({ ...meeting, contactName: e.target.value })
              }
              placeholder="Navn"
            />
            <Label>E-post</Label>
            <Input
              value={meeting.contactEmail}
              onChange={(e) =>
                setMeeting({ ...meeting, contactEmail: e.target.value })
              }
            />
            <Label>Telefon</Label>
            <Input
              value={meeting.contactPhone}
              onChange={(e) =>
                setMeeting({ ...meeting, contactPhone: e.target.value })
              }
            />
            <Button
              onClick={async () => {
                if (!offerEntry) return;
                const d = await saveStatus(offerEntry, "Tilbud sendt", meeting);
                if (!d?.company) return;
                setOfferEntry(null);
                setCreatedCustomer(d.company);
              }}
            >
              Registrer tilbudet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(createdCustomer)}
        onOpenChange={(open) => {
          if (!open) setCreatedCustomer(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kundekortet er opprettet</DialogTitle>
            <DialogDescription>
              {createdCustomer?.name} er registrert med status «Tilbud sendt».
            </DialogDescription>
          </DialogHeader>
          <div className="offer-actions">
            <Button variant="outline" onClick={() => setCreatedCustomer(null)}>
              Fortsett i ringelisten
            </Button>
            <Button
              onClick={() => {
                if (createdCustomer) onGoToCustomer(createdCustomer);
                setCreatedCustomer(null);
              }}
            >
              Gå til kundekort
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(customerChoice)}
        onOpenChange={(open) => {
          if (!open) setCustomerChoice(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Legg til {customerChoice?.name}?</DialogTitle>
            <DialogDescription>
              Kundekortet opprettes med bedriftsinformasjonen fra ringelisten.
            </DialogDescription>
          </DialogHeader>
          <div className="offer-actions">
            <Button variant="outline" onClick={() => setCustomerChoice(null)}>
              Fortsett i ringelisten
            </Button>
            <Button
              onClick={() => {
                if (customerChoice?.company) {
                  onGoToCustomer(customerChoice.company);
                  setCustomerChoice(null);
                } else
                  setCustomerChoice((choice) =>
                    choice ? { ...choice, goWhenReady: true } : null,
                  );
              }}
            >
              {customerChoice?.goWhenReady && customerChoice.saving
                ? "Oppretter kundekort …"
                : "Gå til kundekort"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ProspectRows({
  rows,
  update,
}: {
  rows: CallListEntry[] | Prospect[];
  update: (row: CallListEntry, status: string) => void;
}) {
  return (
    <div className="prospect-list">
      {rows.map((row) => (
        <div className="prospect-row" key={row.id}>
          <div>
            <strong>{row.name}</strong>
            <small>
              Org: {row.orgNumber} · {row.city || "Ukjent sted"}
            </small>
          </div>
          <div>
            <span>{row.industry || "Ukjent bransje"}</span>
            <small>{row.employees ?? "–"} ansatte</small>
          </div>
          <div className="prospect-contact">
            {row.phone ? (
              <PhoneLink phone={row.phone}/>
            ) : (
              <span>Telefon mangler</span>
            )}
            {row.email ? (
              <a href={`mailto:${row.email}`}>{row.email}</a>
            ) : (
              <span>E-post mangler</span>
            )}
            {row.status !== "Ny" && (
              <small>
                {(row as CallListEntry).handledBy
                  ? `Behandlet av ${(row as CallListEntry).handledBy}`
                  : "Medarbeider ikke registrert på eldre aktivitet"}
              </small>
            )}
          </div>
          <div className="prospect-actions">
            <Select
              value={row.status}
              onValueChange={(status) => update(row as CallListEntry, status)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ny">Ny</SelectItem>
                <SelectItem value="Ringte – ikke svar">
                  Ringte – ikke svar
                </SelectItem>
                <SelectItem value="Kontaktet">Kontaktet</SelectItem>
                <SelectItem value="Møte booket">Møte booket</SelectItem>
                <SelectItem value="Tilbud sendt">Tilbud sendt</SelectItem>
                <SelectItem value="Lagt til som kunde">
                  Legg til som kunde
                </SelectItem>
                <SelectItem value="Ikke aktuell">Ikke aktuell</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
function Prospects() {
  const [rows, setRows] = useState<Prospect[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [requirePhone, setRequirePhone] = useState(false),
    [requireEmail, setRequireEmail] = useState(false);
  useEffect(() => {
    apiFetch("/api/prospects")
      .then((r) => r.json())
      .then((d) => setRows(d.prospects ?? []))
      .finally(() => setLoading(false));
  }, []);
  async function generate() {
    setBusy(true);
    try {
      const r = await apiFetch("/api/prospects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "generate",
            requirePhone,
            requireEmail,
          }),
        }),
        d = await r.json();
      if (!r.ok) return toast.error(d.error ?? "Kunne ikke hente prospekter");
      setRows(d.prospects ?? []);
      toast.success(
        d.added
          ? `${d.added} nye prospekter er hentet`
          : "Dagens liste er klar",
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(row: Prospect, status: string) {
    setRows((items) =>
      items.map((item) => (item.id === row.id ? { ...item, status } : item)),
    );
    const r = await apiFetch("/api/prospects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "status", id: row.id, status }),
    });
    if (!r.ok) toast.error("Kunne ikke oppdatere prospektet");
  }
  return (
    <section className="surface prospects">
      <div className="operations-head">
        <div>
          <p className="eyebrow">INTERNT SALG</p>
          <h3>Dagens prospekter</h3>
          <p>
            Aktive norske AS med 1–30 ansatte, hentet fra Brønnøysundregistrene.
          </p>
        </div>
        <Button onClick={generate} disabled={busy}>
          <RefreshCw />
          {busy
            ? "Henter …"
            : rows.length
              ? "Oppdater dagens 50"
              : "Hent dagens 50"}
        </Button>
      </div>
      <div className="contact-requirements internal-filters">
        <label>
          <input
            type="checkbox"
            checked={requirePhone}
            onChange={(e) => setRequirePhone(e.target.checked)}
          />
          Må ha telefonnummer
        </label>
        <label>
          <input
            type="checkbox"
            checked={requireEmail}
            onChange={(e) => setRequireEmail(e.target.checked)}
          />
          Må ha e-postadresse
        </label>
      </div>
      {loading ? (
        <p className="empty-line">Henter prospektlisten …</p>
      ) : rows.length ? (
        <ProspectRows rows={rows} update={update} />
      ) : (
        <div className="empty-state">
          <Building2 />
          <h3>Ingen prospekter hentet</h3>
          <p>Trykk «Hent dagens 50» for å lage den første listen.</p>
        </div>
      )}
    </section>
  );
}
function MarketingPostImage({
  id,
  filename,
  organizationId,
}: {
  id: number;
  filename: string;
  organizationId: number;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    apiFetch(`/api/marketing-images?id=${id}`, {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Kunne ikke hente bildet");
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, organizationId]);
  return src ? (
    <img src={src} alt={filename} loading="lazy" />
  ) : (
    <div className="marketing-image-loading" aria-label="Laster bilde" />
  );
}

function Marketing({
  agreedPrice,
  companies,
  active,
  role,
  members,
  organizationId,
  currentMembershipId,
  onActivated,
}: {
  agreedPrice: number | null;
  active: boolean;
  role: string;
  members: Member[];
  organizationId: number;
  currentMembershipId: number;
  onActivated: (active: boolean) => void;
  companies: Company[];
}) {
  const [unitPrice,setUnitPrice] = useState(agreedPrice);
  const [purchaseBusy,setPurchaseBusy] = useState(false);
  useEffect(()=>setUnitPrice(agreedPrice),[agreedPrice]);
  const [purchaseOpen, setPurchaseOpen] = useState(false),
    [licensed, setLicensed] = useState<number[]>([]),
    [posts, setPosts] = useState<
      {
        id: number;
        content: string;
        platforms: string;
        scheduledAt: string;
        status: string;
        deliveries?: {platform:string;status:string;error:string}[];
        images?: {
          id: number;
          filename: string;
          contentType: string;
          size: number;
        }[];
      }[]
    >([]),
    [content, setContent] = useState(""),
    [scheduledAt, setScheduledAt] = useState(""),
    [platforms, setPlatforms] = useState<string[]>([]),
    [images, setImages] = useState<File[]>([]),
    [savingPost, setSavingPost] = useState(false);
  const [social,setSocial] = useState<SocialState>({ready:false,connections:[]});
  const [publishId,setPublishId] = useState<number|null>(null);
  const [publishing,setPublishing] = useState(false);
  const [deleteId,setDeleteId]=useState<number|null>(null),[deleting,setDeleting]=useState(false);
  const [preparing,setPreparing]=useState(false),[prepareError,setPrepareError]=useState("");
  const [preparedImages,setPreparedImages]=useState<{id:number;blob:Blob;upscaled:boolean}[]>([]);
  const [confirmedTargets,setConfirmedTargets]=useState<{id:number;accountId:string;platform:string;accountName:string}[]>([]);
  const preparedPreviews=useMemo(()=>preparedImages.map(i=>({...i,url:URL.createObjectURL(i.blob)})),[preparedImages]);
  useEffect(()=>()=>preparedPreviews.forEach(i=>URL.revokeObjectURL(i.url)),[preparedPreviews]);
  function openPublish(post:typeof posts[number]){
    setPreparing(true);setPrepareError("");setPreparedImages([]);
    setConfirmedTargets(social.connections.map(c=>({id:c.id,accountId:c.accountId,platform:c.platform,accountName:c.accountName})));
    setPublishId(post.id);
  }
  useEffect(()=>{
    if(!publishId)return;
    let cancelled=false;
    const post=posts.find(p=>p.id===publishId);
    void (async()=>{try{
      const prepared:{id:number;blob:Blob;upscaled:boolean}[]=[];
      if(post&&JSON.parse(post.platforms).includes('Instagram')){
        if(!post.images?.length)throw Error('Legg til minst ett bilde for Instagram.');
        if([...post.content].length>2200)throw Error('Instagram-teksten kan være maks 2 200 tegn.');
        let ratio:number|undefined;
        for(const image of post.images){
          const response=await apiFetch(`/api/marketing-images?id=${image.id}`,{headers:{'x-organization-id':String(organizationId)}});
          if(!response.ok)throw Error(`Kunne ikke hente «${image.filename}». Prøv igjen.`);
          const result=await prepareInstagramImage(await response.blob(),ratio);ratio??=result.ratio;
          prepared.push({id:image.id,blob:result.blob,upscaled:result.upscaled});
        }
      }
      if(!cancelled)setPreparedImages(prepared);
    }catch(error){if(!cancelled)setPrepareError(error instanceof Error?error.message:'Bildene kunne ikke klargjøres.');}
    finally{if(!cancelled)setPreparing(false);}})();
    return ()=>{cancelled=true;};
  },[publishId,organizationId]);
  async function deletePost(){
    if(!deleteId||deleting)return;setDeleting(true);
    try{
      const r=await apiFetch('/api/marketing',{method:'DELETE',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({id:deleteId,confirm:true})});
      const d=await r.json();if(!r.ok)throw Error(d.error??'Kunne ikke fjerne innlegget.');
      setPosts(rows=>rows.filter(p=>p.id!==deleteId));setDeleteId(null);toast.success('Innlegget er fjernet fra innholdsplanen.');
    }catch(error){toast.error(error instanceof Error?error.message:'Kunne ikke fjerne innlegget.');}
    finally{setDeleting(false);}
  }
  const publishPost = posts.find(post=>post.id===publishId);
  function canPublish(post: typeof posts[number]) {
    const selected=JSON.parse(post.platforms) as string[];
    return social.ready && post.status === "Kladd" && selected.length>0 && selected.every(channel=>
      ["Facebook","Instagram"].includes(channel) && social.connections.some(c=>c.platform===channel&&!c.expired));
  }
  async function publishNow() {
    if(!publishPost||publishing||preparing||prepareError)return;
    setPublishing(true);
    try {
      const form=new FormData();form.append('payload',JSON.stringify({postId:publishPost.id,confirm:true,targets:confirmedTargets}));
      preparedImages.forEach(i=>form.append(`image:${i.id}`,i.blob,`image-${i.id}.jpg`));
      const response=await apiFetch("/api/social/publish",{method:"POST",headers:{"x-organization-id":String(organizationId)},body:form});
      const result=await response.json();
      if(!response.ok)throw Error(result.error??"Kunne ikke publisere.");
      setPosts(rows=>rows.map(p=>p.id===publishPost.id?{...p,status:result.status,deliveries:result.results}:p));
      setPublishId(null);
      if(result.status==="Publisert")toast.success("Innlegget er publisert.");
      else toast.error("Kontroller resultatet for hver kanal i innholdsplanen.");
    } catch(error) {
      toast.error(error instanceof Error?error.message:"Svaret mangler. Kontroller status før du forsøker igjen.");
      const r=await apiFetch("/api/marketing",{headers:{"x-organization-id":String(organizationId)}}).catch(()=>null);
      if(r?.ok){const d=await r.json();setPosts(d.posts??[]);}
      setPublishId(null);
    } finally {setPublishing(false);}
  }
  const imagePreviews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );
  useEffect(
    () => () =>
      imagePreviews.forEach((image) => URL.revokeObjectURL(image.url)),
    [imagePreviews],
  );
  const channels = SOCIAL_CHANNELS;
  useEffect(() => {
    if (active)
      apiFetch("/api/marketing", {
        headers: { "x-organization-id": String(organizationId) },
      })
        .then((r) => r.json())
        .then((d) => setPosts(d.posts ?? []))
        .catch(() => undefined);
  }, [active, organizationId]);
  useEffect(() => {
    if (!purchaseOpen || role === "Bruker") return;
    apiFetch("/api/admin", {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((r) => r.json())
      .then((d) => {
        setLicensed(d.modules?.markedsforing?.licensedMemberIds ?? []);
        setUnitPrice(d.pricing?.marketingPrice ?? null);
      })
      .catch(() => undefined);
  }, [organizationId, purchaseOpen, role]);
  async function activate() {
    if (purchaseBusy) return;
    if (unitPrice == null) return toast.error("Pris er ikke avtalt. Kontakt Noracre.");
    if (!licensed.length) return toast.error("Velg minst én bruker");
    setPurchaseBusy(true);
    try {
      const r = await apiFetch("/api/admin", {method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"moduleStatus",moduleKey:"markedsforing",membershipIds:licensed,acceptedPrice:unitPrice})});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Kunne ikke aktivere modulen");
      onActivated(Boolean(d.currentUserActive));
      setPurchaseOpen(false);
      toast.success("Modullisensene er oppdatert");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kunne ikke aktivere modulen"); }
    finally { setPurchaseBusy(false); }
  }

  async function savePost() {
    if (savingPost) return;
    const form = new FormData();
    form.append("content", content);
    form.append("scheduledAt", scheduledAt);
    form.append("platforms", JSON.stringify(platforms));
    images.forEach((image) => form.append("images", image));
    setSavingPost(true);
    try {
      const r = await apiFetch("/api/marketing", {
        method: "POST",
        headers: {
          "x-organization-id": String(organizationId),
        },
        body: form,
      });
      const d = await r.json();
      if (!r.ok) return toast.error(d.error ?? "Kunne ikke lagre innlegget");
      setPosts((rows) => [d.post, ...rows]);
      setContent("");
      setScheduledAt("");
      setImages([]);
      toast.success(
        "Kladden er lagret",
      );
    } catch {
      toast.error("Kunne ikke lagre innlegget. Prøv igjen.");
    } finally {
      setSavingPost(false);
    }
  }
  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (images.length + selected.length > 6)
      return toast.error("Du kan legge til opptil seks bilder per innlegg");
    if (selected.some((file) => !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)))
      return toast.error("Bruk PNG, JPEG, GIF eller WebP.");
    if (selected.some((file) => file.size > 10 * 1024 * 1024))
      return toast.error("Hvert bilde kan være maks 10 MB");
    if ([...images, ...selected].reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024)
      return toast.error("Bildene kan være maks 20 MB samlet.");
    setImages((current) => [...current, ...selected]);
  }
  const chooser = (
    <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Markedsføring for ansatte</DialogTitle>
          <DialogDescription>
            Avtalt pris: {unitPrice} kr per valgt bruker per måned eks. mva.
          </DialogDescription>
        </DialogHeader>
        <div className="module-member-list">
          <div className="module-member-all">
            <strong>Aktive brukere</strong>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const all = members.filter((m) => m.active).map((m) => m.id);
                setLicensed(licensed.length === all.length ? [] : all);
              }}
            >
              Alle
            </Button>
          </div>
          {members
            .filter((m) => m.active)
            .map((m) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={licensed.includes(m.id)}
                  onChange={(e) =>
                    setLicensed((ids) =>
                      e.target.checked
                        ? [...ids, m.id]
                        : ids.filter((id) => id !== m.id),
                    )
                  }
                />
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </span>
              </label>
            ))}
        </div>
        <div className="module-purchase-total">
          <span>{licensed.length} brukere</span>
          <strong>{unitPrice == null ? "Pris ikke avtalt" : `${licensed.length * unitPrice} kr/mnd.`}</strong>
        </div>
        <Button disabled={purchaseBusy || unitPrice == null || !licensed.length} onClick={activate}>Lagre og bekreft pris</Button>
      </DialogContent>
    </Dialog>
  );
  if (!active)
    return (
      <div className="page-pad">
        <section className="surface module-lock">
          <Megaphone />
          <p className="eyebrow">TILLEGGSMODUL</p>
          <h2>Markedsføring</h2>
          <p>
            Planlegg innhold på tvers av kanaler og samle nøkkeltall på ett
            sted.
          </p>
          <strong>{unitPrice == null ? "Kontakt Noracre for avtalt pris" : `${unitPrice} kr per valgt bruker per måned eks. mva.`}</strong>
          {role !== "Bruker" ? (
            <Button disabled={unitPrice == null} onClick={() => setPurchaseOpen(true)}>
              Velg brukere og aktiver
            </Button>
          ) : (
            <p>Be administratoren aktivere modulen.</p>
          )}
        </section>
        {chooser}
      </div>
    );
  return (
    <div className="page-pad marketing-page">
      <div className="operations-head">
        <div>
          <p className="eyebrow">MARKEDSFØRING</p>
          <h2>Innhold og resultater</h2>
        </div>
        {role !== "Bruker" && (
          <Button variant="outline" onClick={() => setPurchaseOpen(true)}>
            <UsersRound />
            Administrer brukere
          </Button>
        )}
      </div>
      <SocialConnections key={organizationId} organizationId={organizationId} role={role} onChange={setSocial}/>
      <div className="metric-grid">
        {["Visninger","Engasjement","Klikk"].map(label=><div className="metric" key={label}><span>{label}</span><strong>—</strong><small>Statistikk kommer senere</small></div>)}
        <Metric
          label="Publisert"
          value={posts.filter((post) => post.status === "Publisert").length}
        />
      </div>
      <section className="surface marketing-composer">
        <div className="surface-head">
          <h3>Lag ett innlegg</h3>
        </div>
        <Textarea
          rows={7}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Skriv innholdet én gang …"
        />
        <div className="marketing-images">
          <label className="marketing-image-upload">
            <Upload size={18} />
            Legg til bilder
            <input type="file" accept="image/*" multiple onChange={addImages} />
          </label>
          {imagePreviews.length > 0 && (
            <div className="marketing-image-previews">
              {imagePreviews.map(({ file, url }, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`}>
                  <img src={url} alt={`Forhåndsvisning av ${file.name}`} />
                  <button
                    type="button"
                    aria-label={`Fjern ${file.name}`}
                    onClick={() =>
                      setImages((current) =>
                        current.filter((_, imageIndex) => imageIndex !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <small>Maks seks bilder, 10 MB per bilde og 20 MB samlet. PNG, JPEG, GIF eller WebP.</small>
        </div>
        <fieldset className="social-channel-fieldset">
          <legend>Velg kanaler</legend>
          <div className="channel-picks social-channel-picks">
            {channels.map((channel) => (
              <label key={channel} className="social-channel-choice">
                <input
                  type="checkbox"
                  className="social-channel-input"
                  checked={platforms.includes(channel)}
                  onChange={(e) => setPlatforms((items) => e.target.checked
                    ? [...items, channel] : items.filter((item) => item !== channel))}
                />
                <span className="social-channel-art">
                  <SocialChannelIcon channel={channel} />
                  <span className="social-channel-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                </span>
                <span className="social-channel-name">{channel}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Label>Ønsket publiseringstidspunkt</Label>
        <DateTimePicker label="Ønsket publiseringstidspunkt" value={scheduledAt} onChange={setScheduledAt} showNow/>
        <Button onClick={savePost} disabled={savingPost}>
          {savingPost ? "Lagrer …" : "Lagre kladd"}
        </Button>
        <p className="form-hint">
          Innlegget lagres som kladd. Publiser til tilkoblede Facebook- og Instagram-kontoer fra innholdsplanen. Tidspunktet er kun til planlegging og starter ingen automatisk publisering.
        </p>
      </section>
      <section className="surface">
        <div className="surface-head">
          <h3>Innholdsplan</h3>
          <span>{posts.length}</span>
        </div>
        {posts.length ? (
          posts.map((post) => (
            <div className="marketing-post" key={post.id}>
              <strong>{post.status === "Planlagt" ? "Kladd" : post.status}</strong>
              <span>{post.content}</span>
              {post.images?.length ? (
                <div className="marketing-post-images">
                  {post.images.map((image) => (
                    <MarketingPostImage
                      key={image.id}
                      id={image.id}
                      filename={image.filename}
                      organizationId={organizationId}
                    />
                  ))}
                </div>
              ) : null}
              <small>
                {JSON.parse(post.platforms).join(", ")}
                {post.scheduledAt ? ` · ${date(post.scheduledAt, true)}` : ""}
              </small>
              {post.deliveries?.map(delivery=><small key={delivery.platform}>{delivery.platform}: {delivery.status === "published" ? "Publisert" : delivery.error || "Publiseringsforsøk pågår. Kontroller kontoen hvis statusen ikke endres."}</small>)}
              <div className="marketing-post-actions">{canPublish(post) && <Button variant="outline" onClick={()=>openPublish(post)}>Publiser nå</Button>}<Button variant="ghost" disabled={post.status==='Publiserer'} aria-label={`Slett innlegg: ${post.content.slice(0,60)}`} onClick={()=>setDeleteId(post.id)}><Trash2 size={16}/>Slett</Button></div>
            </div>
          ))
        ) : (
          <p className="empty-line">Ingen innlegg planlagt ennå.</p>
        )}
      </section>
      <Dialog open={Boolean(publishPost)} onOpenChange={open=>{if(!open&&!publishing)setPublishId(null);}}>
        <DialogContent><DialogHeader><DialogTitle>Publiser innlegget nå?</DialogTitle><DialogDescription>Innlegget blir synlig på kontoene nedenfor med en gang. Et eventuelt planlagt tidspunkt blir ikke brukt.</DialogDescription></DialogHeader>
          {publishPost && <><p style={{whiteSpace:"pre-wrap",maxHeight:"35vh",overflowY:"auto"}}>{publishPost.content}</p><p>{publishPost.images?.length??0} bilder</p>
          <ul>{(JSON.parse(publishPost.platforms) as string[]).map(channel=><li key={channel}>{channel}: {confirmedTargets.find(c=>c.platform===channel)?.accountName}</li>)}</ul></>}
          {preparing&&<p role="status">Klargjør bilder …</p>}
          {prepareError&&<p role="alert">{prepareError}</p>}
          {preparedPreviews.length>0&&<><div className="marketing-publish-previews">{preparedPreviews.map((i,index)=><img key={i.id} src={i.url} alt={`Bilde ${index+1} slik det publiseres`}/>)}</div><p className="form-hint">Tilpasset for Instagram med proporsjonene bevart. Eventuelle marger og gjennomsiktighet får hvit bakgrunn. Animasjoner blir stillbilder.{preparedImages.some(i=>i.upscaled)?' Små originalbilder er forstørret og kan bli mindre skarpe.':''}</p></>}
          {!preparing&&!prepareError&&!preparedPreviews.length&&publishPost?.images?.length?<div className="marketing-publish-previews">{publishPost.images.map(i=><MarketingPostImage key={i.id} id={i.id} filename={i.filename} organizationId={organizationId}/>)}</div>:null}
          <Button disabled={publishing||preparing||Boolean(prepareError)} onClick={publishNow}>{publishing?"Publiserer …":"Bekreft og publiser"}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteId!==null} onOpenChange={open=>{if(!open&&!deleting)setDeleteId(null);}}><DialogContent><DialogHeader><DialogTitle>Slett fra innholdsplanen?</DialogTitle><DialogDescription>Innlegget fjernes fra oversikten i CRM-et. Innlegg som allerede er publisert på Facebook eller Instagram, blir ikke slettet der.</DialogDescription></DialogHeader><p className="marketing-delete-excerpt">{posts.find(p=>p.id===deleteId)?.content}</p><div className="offer-actions"><Button variant="outline" disabled={deleting} onClick={()=>setDeleteId(null)}>Avbryt</Button><Button variant="destructive" disabled={deleting} onClick={deletePost}>{deleting?'Sletter …':'Slett fra innholdsplanen'}</Button></div></DialogContent></Dialog>
      <BulkEmail companies={companies} organizationId={organizationId} />
      {chooser}
    </div>
  );
}
function SuperadminSettings(p: {
  newOrg: NewOrganization;
  setNewOrg: (value: NewOrganization) => void;
  addOrg: () => void;
  members: Member[];
  newMember: { name: string; email: string; role: string };
  setNewMember: (value: { name: string; email: string; role: string }) => void;
  addMember: () => void;
  ownerEmail: string;
}) {
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<Partial<Company>[]>([]);
  const [companySearchBusy, setCompanySearchBusy] = useState(false);
  const [companySearched, setCompanySearched] = useState(false);
  async function searchCompany() {
    if (companyQuery.trim().length < 2) return;
    setCompanySearchBusy(true);
    setCompanySearched(false);
    try {
      const response = await apiFetch(
        `/api/company-lookup?q=${encodeURIComponent(companyQuery)}&includeEnk=1`,
      );
      const data = await response.json();
      if (!response.ok)
        return toast.error(data.error ?? "Kunne ikke søke etter bedriften");
      setCompanyResults(data.companies ?? []);
      setCompanySearched(true);
    } finally {
      setCompanySearchBusy(false);
    }
  }
  function chooseCompany(company: Partial<Company>) {
    p.setNewOrg({
      ...p.newOrg,
      name: company.name ?? "",
      orgNumber: company.orgNumber ?? "",
      address: company.address ?? "",
      postalCode: company.postalCode ?? "",
      city: company.city ?? "",
      industry: company.industry ?? "",
      organizationPhone: company.phone ?? "",
      organizationEmail: company.email ?? "",
    });
    setCompanyQuery(company.name ?? "");
    setCompanyResults([]);
    setCompanySearched(false);
  }
  return (
    <div className="page-pad admin-grid">
      <AdminCard
        eye="SUPERADMIN"
        title="Kundeorganisasjoner"
        ico={<Building2 />}
      >
        <div className="organization-form">
          <div className="lookup-row">
            <Input
              placeholder="Søk etter bedriftsnavn eller organisasjonsnummer"
              value={companyQuery}
              onChange={(event) => {
                setCompanyQuery(event.target.value);
                setCompanyResults([]);
                setCompanySearched(false);
              }}
              onKeyDown={(event) =>
                event.key === "Enter" && void searchCompany()
              }
            />
            <Button
              type="button"
              variant="outline"
              disabled={companySearchBusy}
              onClick={searchCompany}
            >
              {companySearchBusy ? "Søker …" : "Søk i Brreg"}
            </Button>
          </div>
          {companyResults.length > 0 && (
            <div className="lookup-results organization-lookup-results">
              {companyResults.map((company) => (
                <button
                  type="button"
                  key={company.orgNumber}
                  onClick={() => chooseCompany(company)}
                >
                  <Building2 />
                  <span>
                    <strong>{company.name}</strong>
                    <small>
                      Org: {company.orgNumber} · {company.city}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
          {companySearched && !companyResults.length && (
            <p className="form-hint">
              Fant ingen treff. Du kan fylle inn bedriften manuelt nedenfor.
            </p>
          )}
          <Input
            placeholder="Bedriftsnavn"
            value={p.newOrg.name}
            onChange={(e) => p.setNewOrg({ ...p.newOrg, name: e.target.value })}
          />
          <Input
            inputMode="numeric"
            maxLength={11}
            placeholder="Organisasjonsnummer"
            value={p.newOrg.orgNumber}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, orgNumber: e.target.value })
            }
          />
          <Input
            placeholder="Administratorens navn"
            value={p.newOrg.adminName}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, adminName: e.target.value })
            }
          />
          <Input
            placeholder="Administratorens e-post"
            value={p.newOrg.adminEmail}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, adminEmail: e.target.value })
            }
          />
          <Input
            type="tel"
            placeholder="Administratorens telefonnummer"
            value={p.newOrg.adminPhone}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, adminPhone: e.target.value })
            }
          />
          <Select
            value={p.newOrg.adminRole}
            onValueChange={(adminRole) =>
              p.setNewOrg({ ...p.newOrg, adminRole })
            }
          >
            <SelectTrigger aria-label="Administratorens rolle">
              <SelectValue placeholder="Velg rolle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrator">Administrator</SelectItem>
              <SelectItem value="Bruker">Bruker</SelectItem>
            </SelectContent>
          </Select>
          <NegotiatedPrices values={p.newOrg} change={(values) => p.setNewOrg({...p.newOrg,...values})} />
          <Button onClick={p.addOrg}>Opprett kundeorganisasjon</Button>
        </div>
      </AdminCard>
      <AdminCard
        eye="EIERKONTROLL"
        title="Superadministratorer"
        ico={<ShieldCheck />}
      >
        <p>Bare eierkontoen kan gi superadmintilgang.</p>
        <div className="member-list">
          {p.members
            .filter((m) => m.role === "Superadmin")
            .map((m) => (
              <div key={m.id}>
                <div className="avatar">
                  {m.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 3)}
                </div>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </span>
                <em>
                  {["joakimfn@gmail.com", "jfn@noracre.no"].includes(
                    m.email.toLowerCase(),
                  )
                    ? "Eier"
                    : "Superadmin"}
                </em>
              </div>
            ))}
        </div>
        {["joakimfn@gmail.com", "jfn@noracre.no"].includes(
          p.ownerEmail.toLowerCase(),
        ) && (
          <div className="member-form">
            <Input
              placeholder="Navn"
              value={p.newMember.role === "Superadmin" ? p.newMember.name : ""}
              onChange={(e) =>
                p.setNewMember({
                  ...p.newMember,
                  name: e.target.value,
                  role: "Superadmin",
                })
              }
            />
            <Input
              placeholder="E-post"
              value={p.newMember.role === "Superadmin" ? p.newMember.email : ""}
              onChange={(e) =>
                p.setNewMember({
                  ...p.newMember,
                  email: e.target.value,
                  role: "Superadmin",
                })
              }
            />
            <Button onClick={p.addMember}>Gi superadmintilgang</Button>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
function Operations(p: {
  data: OperationsData | null;
  openOrganization: (id: number) => void;
  requestAccess: (id: number) => void;
  setStatus: (id: number, status: string) => void;
  updateDetails: (
    id: number,
    details: Pick<
      OperationOrganization,
      | "name"
      | "orgNumber"
      | "address"
      | "postalCode"
      | "city"
      | "industry"
      | "phone"
      | "email"
    > & PriceFields,
  ) => Promise<boolean>;
}) {
  const [q, setQ] = useState(""),
    [selectedOrganization, setSelectedOrganization] =
      useState<OperationOrganization | null>(null),
    [details, setDetails] = useState({
      crmPrice: "", ringPrice: "", marketingPrice: "",
      name: "",
      orgNumber: "",
      address: "",
      postalCode: "",
      city: "",
      industry: "",
      phone: "",
      email: "",
    }),
    rows = (p.data?.organizations ?? []).filter((o) =>
      o.name.toLowerCase().includes(q.toLowerCase()),
    );
  function openDetails(organization: OperationOrganization) {
    setSelectedOrganization(organization);
    setDetails({
      crmPrice: organization.crmPrice == null ? "" : String(organization.crmPrice),
      ringPrice: organization.ringPrice == null ? "" : String(organization.ringPrice),
      marketingPrice: organization.marketingPrice == null ? "" : String(organization.marketingPrice),
      name: organization.name,
      orgNumber: organization.orgNumber,
      address: organization.address,
      postalCode: organization.postalCode,
      city: organization.city,
      industry: organization.industry,
      phone: organization.phone,
      email: organization.email,
    });
  }
  function emailOrganizations(status: string) {
    const emails = [
      ...new Set(
        (p.data?.organizations ?? [])
          .filter((o) => o.status === status && o.primaryContactEmail)
          .map((o) => o.primaryContactEmail),
      ),
    ];
    if (!emails.length)
      return toast.error("Ingen kontaktpersoner i utvalget har e-postadresse");
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent("Informasjon fra Noracre CRM")}`;
  }
  if (!p.data)
    return (
      <div className="page-pad">
        <section className="surface">
          <p>Laster driftsoversikten …</p>
        </section>
      </div>
    );
  const s = p.data.summary;
  return (
    <div className="page-pad operations">
      <div className="operations-banner">
        <div>
          <p className="eyebrow">KUN FOR SUPERADMIN</p>
          <h2>Drift og kundeoversikt</h2>
          <p>
            Her ser du abonnementer, bruk og supportbehov på tvers av alle
            kundeorganisasjoner.
          </p>
        </div>
        <HealthStatus/>
      </div>
      <div className="metric-grid operations-metrics">
        <Metric
          label="Aktive bedrifter"
          value={s.activeOrganizations}
          tone="green"
        />
        <Metric label="Aktive brukere" value={s.activeUsers} />
        <Metric
          label="Deaktiverte bedrifter"
          value={s.lostOrganizations}
          tone="red"
        />
        <Metric label="Deaktiverte brukere" value={s.lostUsers} tone="red" />
        <Metric label="Ringelistemoduler" value={s.ringModuleOrganizations} />
        <Metric
          label="Markedsføringsmoduler"
          value={s.marketingModuleOrganizations}
        />
        <div className="metric money">
          <span>Beregnet månedsbeløp</span>
          <strong>{s.monthlyAmount.toLocaleString("nb-NO")} kr</strong>
        </div>
      </div>
      <OperationsInsights/>
      <section className="surface">
        <div className="operations-head">
          <div>
            <h3>Kundeorganisasjoner</h3>
            <p>
              Individuelt avtalte priser per bedrift
            </p>
          </div>
          <div className="operations-toolbar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Mail />
                  Send mail
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => emailOrganizations("Aktiv")}>
                  Aktive bedrifter
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => emailOrganizations("Deaktivert")}
                >
                  Deaktiverte bedrifter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="search-box operations-search">
              <Search size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Søk etter kunde …"
              />
            </div>
          </div>
        </div>
        <div className="operations-table">
          <div className="operations-table-head">
            <span>Bedrift</span>
            <span>Kontaktperson</span>
            <span>Brukere</span>
            <span>Moduler</span>
            <span>Bruk siste 30 dager</span>
            <span>Månedsbeløp</span>
            <span>Status og handlinger</span>
          </div>
          {rows.map((o) => (
            <div className="operations-row" key={o.id}>
              <div>
                <button
                  type="button"
                  className="operations-company-button"
                  onClick={() => openDetails(o)}
                >
                  {o.name}
                </button>
                <small>
                  {o.crmCustomers} kunder i CRM · sist brukt{" "}
                  {date(o.lastActivity)}
                </small>
              </div>
              <div className="operations-contact">
                <strong>{o.primaryContactName}</strong>
                {o.primaryContactEmail ? (
                  <a href={`mailto:${o.primaryContactEmail}`}>
                    {o.primaryContactEmail}
                  </a>
                ) : (
                  <small>E-post mangler</small>
                )}
                {o.primaryContactPhone ? (
                  <PhoneLink phone={o.primaryContactPhone}/>
                ) : null}
              </div>
              <span>
                {o.activeUsers} aktive
                {o.lostUsers ? ` · ${o.lostUsers} deaktiverte` : ""}
              </span>
              <span>
                {[
                  o.ringModuleActive
                    ? `Ringelister (${o.ringModuleUsers})`
                    : "",
                  o.marketingModuleActive
                    ? `Markedsføring (${o.marketingModuleUsers})`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Kun CRM"}
              </span>
              <span>{o.activities30d} aktiviteter</span>
              <strong>{o.monthlyAmount.toLocaleString("nb-NO")} kr</strong>
              <div className="operations-actions">
                <Select
                  value={o.status}
                  onValueChange={(v) => p.setStatus(o.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiv">Aktiv</SelectItem>
                    <SelectItem value="Deaktivert">Deaktivert</SelectItem>
                  </SelectContent>
                </Select>
                {o.scheduledDisableAt && <><small>Deaktiveres {date(o.scheduledDisableAt,true)}</small><Button variant="outline" onClick={()=>p.setStatus(o.id,"Aktiv")}>Avbryt deaktivering</Button></>}
                {o.status === "Deaktivert" && o.retainUntil && (
                  <small>Data beholdes til {date(o.retainUntil)}</small>
                )}
                {o.hasSupportAccess ? (
                  <Button onClick={() => p.openOrganization(o.id)}>
                    Åpne CRM
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={o.pendingAccessRequest}
                    onClick={() => p.requestAccess(o.id)}
                  >
                    <Headphones />
                    {o.pendingAccessRequest
                      ? "Forespørsel sendt"
                      : "Be om tilgang"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Dialog
        open={Boolean(selectedOrganization)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrganization(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrganization?.name}</DialogTitle>
            <DialogDescription>
              Kundeinformasjon, abonnement og bruk av Noracre CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="organization-detail-summary">
            <div>
              <span>Brukere</span>
              <strong>{selectedOrganization?.activeUsers ?? 0} aktive</strong>
            </div>
            <div>
              <span>Kunder i CRM</span>
              <strong>{selectedOrganization?.crmCustomers ?? 0}</strong>
            </div>
            <div>
              <span>Månedsbeløp</span>
              <strong>
                {(selectedOrganization?.monthlyAmount ?? 0).toLocaleString(
                  "nb-NO",
                )}{" "}
                kr
              </strong>
            </div>
          </div>
          <div className="form-grid organization-detail-form">
            <div className="full">
              <Label>Bedriftsnavn</Label>
              <Input
                value={details.name}
                onChange={(event) =>
                  setDetails({ ...details, name: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Organisasjonsnummer</Label>
              <Input
                inputMode="numeric"
                value={details.orgNumber}
                onChange={(event) =>
                  setDetails({ ...details, orgNumber: event.target.value })
                }
                placeholder="9 sifre"
              />
            </div>
            <div>
              <Label>Bransje</Label>
              <Input
                value={details.industry}
                onChange={(event) =>
                  setDetails({ ...details, industry: event.target.value })
                }
                placeholder="Ikke registrert"
              />
            </div>
            <div className="full">
              <Label>Adresse</Label>
              <Input
                value={details.address}
                onChange={(event) =>
                  setDetails({ ...details, address: event.target.value })
                }
                placeholder="Ikke registrert"
              />
            </div>
            <div>
              <Label>Postnummer</Label>
              <Input
                value={details.postalCode}
                onChange={(event) =>
                  setDetails({ ...details, postalCode: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Poststed</Label>
              <Input
                value={details.city}
                onChange={(event) =>
                  setDetails({ ...details, city: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                type="tel"
                value={details.phone}
                onChange={(event) =>
                  setDetails({ ...details, phone: event.target.value })
                }
                placeholder="Ikke registrert"
              />
            </div>
            <div>
              <Label>E-post</Label>
              <Input
                type="email"
                value={details.email}
                onChange={(event) =>
                  setDetails({ ...details, email: event.target.value })
                }
                placeholder="Ikke registrert"
              />
            </div>
          </div>
          <NegotiatedPrices values={details} change={(values) => setDetails({...details,...values})} />
          <p className="form-hint">Lagre prisene dere har avtalt. Endringen gjelder eksisterende og nye brukerlisenser fra nå; tidligere fakturagrunnlag beholdes.</p>
          <div className="offer-actions">
            <Button
              variant="outline"
              onClick={() => setSelectedOrganization(null)}
            >
              Lukk
            </Button>
            <Button
              onClick={async () => {
                if (!selectedOrganization) return;
                if (await p.updateDetails(selectedOrganization.id, details))
                  setSelectedOrganization(null);
              }}
            >
              Lagre informasjon
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Card(p: {
  eye: string;
  title: string;
  ico: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface">
      <div className="surface-head">
        <div>
          <p className="eyebrow">{p.eye}</p>
          <h3>{p.title}</h3>
        </div>
        {p.ico}
      </div>
      {p.children}
    </section>
  );
}
function AdminCard(p: {
  eye?: string;
  title: string;
  ico: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="surface admin-card">
      <summary>
        <div>
          {p.eye && <p className="eyebrow">{p.eye}</p>}
          <h3>{p.title}</h3>
        </div>
        <span>
          {p.ico}
          <ChevronRight className="admin-chevron" />
        </span>
      </summary>
      <div className="admin-card-body">{p.children}</div>
    </details>
  );
}
function AvatarCropDialog({
  open,
  setOpen,
  src,
  x,
  y,
  zoom,
  change,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  src: string;
  x: number;
  y: number;
  zoom: number;
  change: (next: {
    avatarX: number;
    avatarY: number;
    avatarZoom: number;
  }) => void;
}) {
  const drag = useRef<{
      clientX: number;
      clientY: number;
      x: number;
      y: number;
    } | null>(null),
    clamp = (value: number) => Math.max(0, Math.min(100, value));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tilpass profilbildet</DialogTitle>
          <DialogDescription>
            Dra bildet med musen for å plassere det. Bruk skyveknappen for å
            zoome.
          </DialogDescription>
        </DialogHeader>
        <div className="linkedin-crop">
          <div
            className="crop-stage"
            onPointerDown={(event) => {
              drag.current = {
                clientX: event.clientX,
                clientY: event.clientY,
                x,
                y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              change({
                avatarX: clamp(
                  drag.current.x + (event.clientX - drag.current.clientX) / 4,
                ),
                avatarY: clamp(
                  drag.current.y + (event.clientY - drag.current.clientY) / 4,
                ),
                avatarZoom: zoom,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {src && (
              <img
                src={src}
                alt="Forhåndsvisning av profilbilde"
                draggable={false}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) scale(${zoom / 100})`,
                }}
              />
            )}
            <div className="crop-mask" />
          </div>
          <div className="crop-zoom">
            <span>−</span>
            <Input
              aria-label="Zoom profilbilde"
              type="range"
              min="100"
              max="250"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                change({
                  avatarX: clamp(x),
                  avatarY: clamp(y),
                  avatarZoom: nextZoom,
                });
              }}
            />
            <span>+</span>
          </div>
          <Button onClick={() => setOpen(false)}>Bruk bildet</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function NegotiatedPrices({values,change}:{values:PriceFields;change:(value:PriceFields)=>void}) {
  return <fieldset className="negotiated-prices"><legend>Avtalte priser</legend>
    <p className="form-hint">Kroner per bruker per måned, eks. mva. Skriv 0 hvis inkludert. Tom modulpris betyr at pris må avtales før kjøp.</p>
    {([["crmPrice","CRM-bruker"],["ringPrice","Ringelister"],["marketingPrice","Markedsføring"]] as const).map(([key,label])=><label key={key}>{label}<Input type="number" min="0" max="1000000" step="1" inputMode="numeric" required={key==="crmPrice"} value={values[key]} onChange={e=>change({...values,[key]:e.target.value})} placeholder={key==="crmPrice"?"Avtalt pris":"Ikke avtalt"}/></label>)}
  </fieldset>;
}
