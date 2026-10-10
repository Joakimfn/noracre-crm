"use client";
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useCrmApi} from "@/lib/crm-api";
import {CommissionField} from "@/components/commission-field";
import {SavedCallListManager} from "@/components/saved-call-list-manager";
import {HomeCountryPicker} from '@/components/home-country-picker';
import {registerCountries} from '@/lib/operating-countries';
import {OperatingCountryPicker} from "@/components/operating-country-picker";
import {type RegisterCountry} from "@/lib/operating-countries";
import {PartnerOverview} from "@/components/partner-overview";
import {PartnerPreview} from "@/components/partner-preview";
import {PartnerPicker,ReferrerSelect} from "@/components/partner-management";
import {defaultI18n,type MessageKey} from "@/lib/i18n";
import {useI18n} from "@/lib/i18n/react";
import {CallListMultiPicker} from '@/components/call-list-multi-picker';
import {NorwegianDateInput} from '@/components/norwegian-date-input';
import {mapProspectRows,mapHeadcountRows} from '@/lib/prospect-import';
import {NormalizedNumberInput} from '@/components/normalized-number-input';
import {defaultCallListFilters} from '@/lib/call-list-filters';

import { ModuleShowcase } from "@/components/module-showcase";
import { canManageModules, canViewAdministration } from "@/lib/roles";
import { CompanyUserCreate } from "@/components/company-user-create";
import { useAutosave } from "@/hooks/use-autosave";
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

import {ContactEditor} from "@/components/contact-editor";
import {ReminderFields} from "@/components/reminder-fields";
import {matchesCustomer} from "@/lib/customer-search";
import { activeReminder } from "@/lib/followup-reminder";

import {
  ChangeEvent,
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DataImporter } from "@/components/data-importer";
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
  | "operations"
  | "partner";
type Company = {
  id: number;
  customerType?: string;
  name: string;
  orgNumber: string;
  contactName: string;
  searchContacts?: {name:string;title?:string;email?:string;phone?:string}[];
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
  reminderMinutes?: string;
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
type Organization = { id: number; name: string; status?: string; isPartner?: boolean };
type PriceFields = { crmPrice: string; ringPrice: string; marketingPrice: string };
type NewOrganization = PriceFields & {
  homeCountry: string;
  operatingCountries: RegisterCountry[];
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
  commissionPercent: string;
  referredByPartnerId: string;
};
const emptyNewOrganization: NewOrganization = {
  homeCountry: "NO",
  operatingCountries: ["NO"],
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
  commissionPercent: "",
  referredByPartnerId: "none",
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
  commissionBps: number|null; isPartner: boolean; referredByPartnerId: number | null; partnerAssignedAt: string;
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
  counties: {value:string;label:string}[];
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
function loadCallListInitial(organizationId: number, force = false, request=apiFetch) {
  force ||= organizationId < 0;
  const cached = callListCache.get(organizationId);
  if (!force && cached && Date.now() - cached.loadedAt < 120_000)
    return Promise.resolve(cached);
  const running = callListLoads.get(organizationId);
  if (!force && running) return running;
  const headers = { "x-organization-id": String(organizationId) };
  const promise = Promise.allSettled([
    request("/api/call-lists", { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Kunne ikke hente ringelisten");
      return data.entries ?? [];
    }),
    request("/api/call-list-options", { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Kunne ikke hente filtrene");
      return {
        counties: Array.isArray(data.counties) ? data.counties : [],
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
              counties: [],
        municipalities: [],
              industries: [],
              organizationForms: organizationFormFallbackOptions,
            };
      const next = { entries, options, loadedAt: Date.now() };
      if(organizationId>0)callListCache.set(organizationId, next);
      callListLoads.delete(organizationId);
      return next;
    })
    .catch((error) => {
      callListLoads.delete(organizationId);
      throw error;
    });
  if(organizationId>0)callListLoads.set(organizationId, promise);
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
            <h2><UiText text="Ringelister kunne ikke åpnes" /></h2>
            <p><UiText text="Last inn fanen på nytt. Ingen ringelistedata er slettet." /></p>
            <Button onClick={() => window.location.reload()}><UiText text="Last inn på nytt" /></Button>
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
function date(v:string,time=false,i18n=defaultI18n){
 if(!v)return i18n.t('common.noDate');
 const value=new Date(v);if(!Number.isFinite(value.getTime()))return i18n.t('common.noDate');
 return i18n.date(value,time?{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short'});
}
function followUpLabel(v?:string,i18n=defaultI18n){
 if(!v)return i18n.t('followup.none');
 return i18n.t('followup.planned',{date:i18n.date(new Date(v),{day:'numeric',month:'short',year:'numeric'})});
}
function daysSince(v?:string,i18n=defaultI18n){
 if(!v)return i18n.t('contact.never');
 const days=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/86400000));
 return days===0?i18n.t('common.today'):i18n.t('common.days',{count:days});
}
function useCrmFormatting(){const i18n=useI18n();return {date:(v:string,time=false)=>date(v,time,i18n),followUpLabel:(v?:string)=>followUpLabel(v,i18n),daysSince:(v?:string)=>daysSince(v,i18n),number:i18n.number};}
function fileSize(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
}
const titleKeys: Record<View, MessageKey> = {
  overview: "nav.overview",
  customers: "nav.customers",
  followup: "nav.followup",
  reports: "nav.reports",
  calllists: "nav.calllists",
  admin: "nav.admin",
  marketing: "nav.marketing",
  superadmin: "nav.superadmin",
  operations: "nav.operations",
  partner: "nav.partner",
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

export default function Home({demoMode=false,onDemoClose,onDemoReset}:{demoMode?:boolean;onDemoClose?:()=>void;onDemoReset?:()=>void}={}) {
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

 const {t,locale,setLocale,applyOrganizationLocale}=useI18n();
  const [partnerPreview,setPartnerPreview]=useState(false),[partnerPreviewKey,setPartnerPreviewKey]=useState("");
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
    [supportExpiresAt,setSupportExpiresAt]=useState(""),
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
  const [profileReady, setProfileReady] = useState(false);
  const profileSaveValue = JSON.stringify({ displayName: profile.displayName, contactEmail: profile.contactEmail, theme: profile.theme, avatarX: profile.avatarX, avatarY: profile.avatarY, avatarZoom: profile.avatarZoom, browserNotifications: profile.browserNotifications, avatarFile: profileAvatar ? `${profileAvatar.name}:${profileAvatar.size}:${profileAvatar.lastModified}` : null });
  const profileAutosave = useAutosave({ value: profileSaveValue, enabled: profileReady && !cropOpen, save: saveProfile });
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
    setDeactivation(null);toast.success(ui(effectiveAt?'Deaktivering er planlagt':'Deaktivert'));
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
  const [nextReminders,setNextReminders] = useState<number[]>([15]);
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
    applyOrganizationLocale(ad.language === "en" ? "en" : "nb",orgId);
    setRolePreview(ad.role ?? "Bruker");
    if(!canViewAdministration(ad.role ?? "Bruker"))setView(current=>current==="admin"?"overview":current);
    setCompanies(c.companies ?? []);
    setActivities(a.activities ?? []);
    setMembers(ad.members ?? []);
    setPricing(ad.pricing ?? {crmPrice:null,ringPrice:null,marketingPrice:null});
    setMemberModuleCosts(ad.memberModuleCosts ?? {});
    setSupportRequests(ad.supportRequests ?? []);
    setSupportAccess(Boolean(ad.activeSupport));
    setSupportExpiresAt(ad.supportExpiresAt??"");
    setCurrentMembershipId(Number(ad.membershipId) || 0);
    const ringActive = Boolean(ad.modules?.ringelister?.currentUserActive);
    setRingModuleActive(ringActive);
    setMarketingModuleActive(
      Boolean(ad.modules?.markedsforing?.currentUserActive),
    );
    if (ringActive) void loadCallListInitial(orgId,false,apiFetch).catch(() => undefined);
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
    const entry=new URLSearchParams(demoMode?"":window.location.search),entryOrg=Number(entry.get("organization"));
    apiFetch("/api/session",entry.has("supportRequest")&&Number.isSafeInteger(entryOrg)&&entryOrg>0?{headers:{"x-organization-id":String(entryOrg)}}:{})
      .then(async (r) => {
        const s = await r.json();
        if (!r.ok)
          throw Object.assign(new Error(s.error ?? "Kunne ikke åpne CRM-et"), {
            code: s.code ?? "",
          });
        return s;
      })
      .then(async (s) => {
        const supportLink=new URLSearchParams(demoMode?"":window.location.search);
        const linkedOrg=Number(supportLink.get("organization"));
        const id = supportLink.has("supportRequest") && (s.organizations??[]).some((o:{id:number})=>o.id===linkedOrg) ? linkedOrg : s.currentOrganizationId ?? 1;
        setActiveOrgId(id);
        setOrganizations(s.organizations ?? []);
        setRolePreview(s.role ?? "Bruker");
        if (supportLink.has("supportRequest")) setView("admin");
        else if (s.role === "Superadmin") {
          setView("operations");
          if(s.partnerPreviewVersion){
            const key="noracre:partner-preview:"+s.partnerPreviewVersion+":"+(s.user?.id||s.user?.email);
            setPartnerPreviewKey(key);
            try { if(localStorage.getItem(key)!=="seen")setPartnerPreview(true); } catch {setPartnerPreview(true);}
          }
        }
        setUser(s.user ?? { displayName: "Min konto", email: "" });
        apiFetch("/api/profile", { headers: { "x-organization-id": String(id) } })
          .then((r) => r.json())
          .then((d) => {
            const next = d.profile ?? {};
            const loadedProfile = {
              displayName: next.displayName || s.user?.displayName || "",
              contactEmail: next.contactEmail || s.user?.email || "",
              theme: next.theme || "light",
              avatarKey: next.avatarKey || "",
              avatarX: next.avatarX ?? 50,
              avatarY: next.avatarY ?? 50,
              avatarZoom: next.avatarZoom ?? 100,
              browserNotifications: Boolean(next.browserNotifications),
            };
            setProfile(loadedProfile);
            profileAutosave.reset(JSON.stringify({ displayName: loadedProfile.displayName, contactEmail: loadedProfile.contactEmail, theme: loadedProfile.theme, avatarX: loadedProfile.avatarX, avatarY: loadedProfile.avatarY, avatarZoom: loadedProfile.avatarZoom, browserNotifications: loadedProfile.browserNotifications, avatarFile: null }));
            setProfileReady(true);
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
            ui(e instanceof Error ? e.message : "Kunne ikke hente CRM-data"),
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
    if(demoMode)return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", profile.theme === "dark" || (profile.theme === "system" && media.matches));
    apply();
    if (profile.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile.theme]);
  async function saveProfile(serialized: string) {
    const snapshot = JSON.parse(serialized);
    const avatar = profileAvatar;
    const preview = profilePreview;
    const form = new FormData();
    for (const field of ["displayName", "contactEmail", "theme", "avatarX", "avatarY", "avatarZoom", "browserNotifications"]) {
      form.set(field, String(snapshot[field]));
    }
    if (avatar) form.set("avatar", avatar);
    try {
      const r = await api("/api/profile", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw Error(d.error ?? "Kunne ikke lagre innstillingene");
      setUser(current => ({...current, displayName: d.profile.displayName, email: d.profile.contactEmail}));
      // Keep edits made while this request was in flight. Only the server's
      // file key needs to be merged into the current draft.
      setProfile(current => ({...current, avatarKey: d.profile.avatarKey}));
      if (avatar) {
        setProfileAvatar(current => current === avatar ? null : current);
        setProfilePreview(current => current === preview ? "" : current);
        if (preview) URL.revokeObjectURL(preview);
        setAvatarVersion(v => v + 1);
      }
      callListCache.delete(activeOrgId);
      if(!demoMode)window.dispatchEvent(new Event("crm-profile-updated"));
      if (snapshot.displayName !== user.displayName) {
        await Promise.allSettled([
          refreshCrmData(),
          api("/api/admin").then(async response => {
            if (response.ok) setMembers((await response.json()).members ?? []);
          }),
        ]);
      }
    } catch (error) {
      toast.error(ui(error instanceof Error ? error.message : "Kunne ikke lagre innstillingene"));
      throw error;
    }
  }
  const filtered = useMemo(
      () =>
        companies.filter((c) => matchesCustomer(c, query)),
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
      demoMode || partnerPreview || !sessionReady ||
      !("Notification" in window)
    )
      return;
    const check = () => {
      if(Notification.permission !== "granted")return;
      const now = Date.now();
      for (const activity of activities) {
        const offset = activeReminder(activity, now);
        if (offset === null) continue;
        const due = new Date(activity.dueAt).getTime();
        const key = `noracre-reminder:${user.id}:${activeOrgId}:${activity.id}:${activity.dueAt}:${offset}`;
        if (localStorage.getItem(key)) continue;
        const notification = new Notification("Kommende oppfølging", {
          body: `${activity.companyName}: ${activity.note || ui("Følg opp")} – ${locale==='en'?'at':'kl.'} ${new Date(due).toLocaleString(locale==='en'?'en-GB':'nb-NO', {day:"2-digit",month:"2-digit",hour: "2-digit", minute: "2-digit"})}`,
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
  }, [sessionReady, activities, activeOrgId, user.id, demoMode, partnerPreview]);
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
        setSelectedContactId(0);
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
        toast.error(ui(d.error ?? "Kunne ikke søke i Brønnøysundregistrene"));
    } catch {
      setLookupResults([]);
      toast.error(ui("Kunne ikke søke i Brønnøysundregistrene"));
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
        assignedTo: user.displayName,
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
    toast.success(ui("Kunden er lagt til"));
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
      if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke laste opp filen"));
      setAttachments((x) => [d.attachment, ...x]);
      toast.success(ui("Vedlegget er lastet opp"));
    } finally {
      setUploading(false);
    }
  }
  async function downloadAttachment(file: Attachment) {
    const r = await api(`/api/attachments?id=${file.id}`);
    if (!r.ok) return toast.error(ui("Kunne ikke laste ned filen"));
    const url = URL.createObjectURL(await r.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAttachment(file: Attachment) {
    const r = await api(`/api/attachments?id=${file.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error(ui("Kunne ikke slette vedlegget"));
    setAttachments((x) => x.filter((a) => a.id !== file.id));
    toast.success(ui("Vedlegget er slettet"));
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
            reminderMinutes: JSON.stringify(nextReminders),
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
    toast.success(ui(`${kind} er registrert`));
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
          reminderMinutes: nextReminders,
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
      toast.error(ui("Aktiviteten kunne ikke lagres. Prøv igjen."));
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
    } catch { await reloadActivities(); toast.error(ui("Kunne ikke fullføre oppfølgingen")); return; }
    toast.success(ui("Markert som utført"));
  }
  async function deleteHistory(a: Activity) {
    const r = await api(`/api/activities?id=${a.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error(ui("Kunne ikke slette hendelsen"));
    setActivities((x) => x.filter((item) => item.id !== a.id));
    toast.success(ui("Hendelsen er slettet"));
  }
  async function refresh(c: Company) {
    if (!c.orgNumber) return toast.error(ui("Organisasjonsnummer mangler"));
    const d = await (
        await apiFetch(`/api/company-lookup?q=${encodeURIComponent(c.orgNumber)}`)
      ).json(),
      f = d.companies?.[0];
    if (!f) return toast.error(ui("Fant ikke bedriften"));
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
    toast.success(ui("Bedriftsdata er oppdatert"));
  }
  function calendar() {}
  async function addMember(confirmed = false) {
    if (memberBusy || !newMember.name || !newMember.email) return;
    if (pricing.crmPrice == null) return toast.error(ui("Pris er ikke avtalt. Oppgi pris under Drift først."));
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
      if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke invitere brukeren"));
      m.id = d.member.id;
      if(!demoMode)await navigator.clipboard?.writeText(window.location.origin)
        .catch(() => undefined);
      setMembers((x) => [...x, m]);
      setNewMember({ name: "", email: "", role: "Bruker" });
      toast.success(ui(demoMode ? "Demobrukeren er opprettet" : d.invitationSent ? "Brukeren er opprettet og invitasjonen er sendt" : "Brukeren er opprettet. Invitasjonen kunne ikke sendes; del innloggingslenken manuelt."));
    } catch {
      toast.error(ui("Kunne ikke invitere brukeren"));
    } finally { setMemberBusy(false); }
  }
  async function setMemberStatus(
    member: Member,
    active: boolean,
    confirmed = false,
  ) {
    if(active && !member.active && pricing.crmPrice == null) return toast.error(ui("Pris er ikke avtalt. Oppgi pris under Drift først."));
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
    if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke endre brukeren"));
    setMembers((rows) =>
      rows.map((row) => (row.id === member.id ? { ...row, ...d.member } : row)),
    );
    toast.success(ui(active ? "Brukeren er aktivert" : "Brukeren er deaktivert"));
  }
  async function support(v: boolean) {
    try{const r=await api('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'support',enabled:v})});const d=await r.json();if(!r.ok)throw Error(d.error??'Kunne ikke endre tilgangen');setSupportAccess(v);setSupportExpiresAt(d.session?.expiresAt??'');toast.success(ui(v?'Support har tilgang i 24 timer':'Supporttilgangen er stengt'));}catch(e){toast.error(ui(e instanceof Error?e.message:'Kunne ikke endre tilgangen'));}
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
      const data=await r.json();if(!r.ok)throw Error(data.error||"Kunne ikke lagre kontaktpersonen");c.id=data.contact.id;
    } catch(e) {toast.error(ui(e instanceof Error?e.message:"Kunne ikke lagre kontaktpersonen"));return;}
    setContacts((x) => [...x, c]);
    setSelectedContactId(c.id);
    setNewContact({ name: "", title: "", phone: "", email: "" });
    setPersonOpen(false);
    await refreshCrmData();
    toast.success(ui("Kontaktpersonen er lagt til"));
  }
  async function addOrganization() {
    if (!newOrg.name || !newOrg.adminEmail) return;
    if (newOrg.crmPrice === "") return toast.error(ui("Oppgi avtalt pris per CRM-bruker."));
    const r = await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "organization", ...newOrg }),
    });
    if (!r.ok)
      return toast.error(
        ui((await r.json()).error ?? "Kunne ikke opprette organisasjonen"),
      );
    const data = await r.json();
    const org = data.organization;
    setOrganizations((x) => [...x, org]);
    setNewOrg(emptyNewOrganization);
    toast.success(ui(data.invitationSent ? "Bedriften er opprettet og invitasjonen er sendt" : "Bedriften er opprettet, men invitasjonen kunne ikke sendes. Del https://crm.noracre.no med kontaktpersonen."));
  }
  async function switchOrganization(id: number) {
    try {
      await loadOrganization(id);
      setActiveOrgId(id);
      setView("overview");
      toast.success(ui("Organisasjonen er byttet"));
    } catch (e) {
      toast.error(ui(e instanceof Error ? e.message : "Du har ikke tilgang"));
    }
  }
  async function requestSupportAccess(id: number) {
    const r = await api("/api/superadmin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "requestAccess", organizationId: id }),
    });
    const result=await r.json();
    if (!r.ok) return toast.error(ui(result.error??"Kunne ikke sende forespørselen"));
    setOperations((d) =>
      d
        ? {
            ...d,
            organizations: d.organizations.map((o) =>
              o.id === id ? { ...o, pendingAccessRequest: Boolean(result.notificationSent) } : o,
            ),
          }
        : d,
    );
    if(result.notificationSent)toast.success(ui("Forespørselen er sendt til bedriftens administrator på e-post"));
    else toast.error(ui("Forespørselen er lagret, men e-posten kunne ikke sendes. Trykk Be om tilgang for å prøve igjen."));
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
    if (!r.ok) return toast.error(ui("Kunne ikke endre status"));
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
    > & PriceFields & {referredByPartnerId:string;commissionPercent:string},
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
      toast.error(ui(d.error ?? "Kunne ikke lagre bedriftsinformasjonen"));
      return false;
    }
    const refreshed = await api("/api/superadmin").then(r=>r.json());
    if (!refreshed.error) setOperations(refreshed);
    await loadOrganization(activeOrgId);
    toast.success(ui("Bedriftsinformasjonen er lagret"));
    return true;
  }
  async function approveSupport(requestId: number,duration:"24h"|"untilRevoked"="24h") {
    const r = await api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "supportApproval", requestId,duration }),
    });
    if (!r.ok) return toast.error(ui("Kunne ikke godkjenne tilgangen"));
    const result=await r.json();
    setSupportAccess(true);
    setSupportExpiresAt(result.expiresAt??"");
    setSupportRequests((x) => x.filter((item) => item.id !== requestId));
    toast.success(ui(duration==="untilRevoked"?"Support har tilgang til du slår den av":"Support har tilgang i 24 timer"));
  }
  async function finishOnboarding() {
    if (!accepted) return;
    if(!demoMode)localStorage.setItem("noracre-tutorial-2026-09-09-v2", "seen");
    setOnboardingOpen(false);
    toast.success(ui("Du er klar til å bruke Noracre CRM"));
    const r = await apiFetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptedTerms: true, completedOnboarding: true }),
    });
    if (!r.ok) {
      setOnboardingOpen(true);
      return toast.error(ui("Kunne ikke lagre godkjenningen"));
    }
  }
  async function exportBackup() {
    const r = await api("/api/export");
    if (!r.ok) return toast.error(ui("Kunne ikke lage sikkerhetskopi"));
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
    toast.success(ui("Sikkerhetskopien er lastet ned"));
  }
  if (!sessionReady)
    return (
      <main className="session-loading" role="status" aria-live="polite" aria-label={ui("Åpner Noracre CRM")}>
        <img src="/noracre-logo-primary.svg" alt="Noracre" />
        <span><UiText text="Gjør klart arbeidsområdet ditt …" /></span>
      </main>
    );
  if (accessError.message)
    return (
      <AccessDenied message={accessError.message} code={accessError.code} />
    );
  if(partnerPreview && rolePreview === "Superadmin")return <PartnerPreview onClose={()=>{
    if(partnerPreviewKey)try{localStorage.setItem(partnerPreviewKey,"seen");}catch{}
    setPartnerPreview(false);
  }}/>;
  return (
    <main className="app-shell signature-shell" onClickCapture={demoMode?e=>{const target=e.target as HTMLElement;const link=target.closest("a");if(link){e.preventDefault();e.stopPropagation();toast.info(ui("Eksterne lenker er deaktivert i demoen."));}}:undefined}>
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
        <nav aria-label={t('nav.main')}>
          <Nav
            a={view === "overview"}
            click={() => setView("overview")}
            ico={<LayoutDashboard size={20} />}
            text={t('nav.overview')}
          />
          <Nav
            a={view === "customers"}
            click={() => setView("customers")}
            ico={<UsersRound size={20} />}
            text={t('nav.customers')}
          />
          <Nav
            a={view === "followup"}
            click={() => setView("followup")}
            ico={<CalendarCheck2 size={20} />}
            text={t('nav.followup')}
            count={overdue.length + dueToday.length}
          />
          <Nav
            a={view === "reports"}
            click={() => setView("reports")}
            ico={<BarChart3 size={20} />}
            text={t('nav.reports')}
          />
          <Nav
            a={view === "calllists"}
            click={() => setView("calllists")}
            ico={<Phone size={20} />}
            text={t('nav.calllists')}
          />
          <Nav
            a={view === "marketing"}
            click={() => setView("marketing")}
            ico={<Megaphone size={20} />}
            text={t('nav.marketing')}
          />
          {canViewAdministration(rolePreview) && (
            <Nav
              a={view === "admin"}
              click={() => {
                setNewMember({ name: "", email: "", role: "Bruker" });
                setView("admin");
              }}
              ico={<Settings size={20} />}
              text={t('nav.admin')}
            />
          )}
        </nav>
        <div className="sidebar-bottom">
        {rolePreview === "Superadmin" && (
          <nav className="super-nav" aria-label="Superadmin">
            <Nav
              a={view === "operations"}
              click={() => setView("operations")}
              ico={<Gauge size={20} />}
              text={t('nav.operationsShort')}
            />
            <Nav
              a={view === "superadmin"}
              click={() => {
                setNewMember({ name: "", email: "", role: "Superadmin" });
                setView("superadmin");
              }}
              ico={<ShieldCheck size={20} />}
              text={t('nav.superadmin')}
            />
          </nav>
        )}
        {rolePreview === "Partner" && organizations.find(o=>o.id===activeOrgId)?.isPartner && <nav className="super-nav" aria-label={t("nav.partner")}><Nav a={view === "partner"} click={()=>setView("partner")} ico={<Building2 size={20}/>} text={t("nav.partner")}/></nav>}
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
              <Settings /><UiText text="Innstillinger" /></DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if(demoMode){onDemoClose?.();return;}
                const usesSupabase = Boolean(getStoredAccessToken());
                clearStoredSession();
                window.location.assign(
                  usesSupabase ? "/" : "/signout-with-chatgpt?return_to=/",
                );
              }}
            >
              <LogOut /><UiText text="Logg ut" /></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </aside>
      {!profileOpen && profileAutosave.state === "error" && <div role="alert" className="form-hint"><UiText text="Innstillingene kunne ikke lagres. " /><Button variant="outline" onClick={() => setProfileOpen(true)}><UiText text="Åpne innstillinger" /></Button></div>}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle><UiText text="Mine innstillinger" /></DialogTitle>
            <DialogDescription><UiText text="Profilen og utseendet gjelder bare brukeren din. Endringer lagres automatisk." /></DialogDescription>
          </DialogHeader>
          <div className="profile-settings">
            <Label><UiText text="Profilbilde" /></Label>
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
              <label className="photo-upload-button"><UiText text="Velg bilde" /><input
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
                ><UiText text="Rediger bilde" /></Button>
              )}
            </div>
            <Label><UiText text="Navn" /></Label>
            <Input
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
            />
            <Label><UiText text="E-post" /></Label>
            <Input
              type="email"
              value={profile.contactEmail}
              onChange={(e) =>
                setProfile({ ...profile, contactEmail: e.target.value })
              }
            />
            <Label htmlFor="profile-language">{locale==='nb'?'Språk':'Language'}</Label>
            <Select value={locale} onValueChange={value=>setLocale(value==='en'?'en':'nb')}>
              <SelectTrigger id="profile-language"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="nb"><img src="/flags/no.svg" alt="" width="20" height="14" style={{width:20,height:14,objectFit:'fill',display:'inline-block',verticalAlign:'middle',flexShrink:0}}/> Norsk</SelectItem><SelectItem value="en"><img src="/flags/gb.svg" alt="" width="20" height="14" style={{width:20,height:14,objectFit:'fill',display:'inline-block',verticalAlign:'middle',flexShrink:0}}/> English</SelectItem></SelectContent>
            </Select>
            <p className="form-hint">{locale==='nb'?'Språkvalget huskes i denne nettleseren.':'Your language preference is remembered in this browser.'}</p>
            <Label><UiText text="Tema" /></Label>
            <Select
              value={profile.theme}
              onValueChange={(theme) => setProfile({ ...profile, theme })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system"><UiText text="Følg systemet" /></SelectItem>
                <SelectItem value="light"><UiText text="Lys modus" /></SelectItem>
                <SelectItem value="dark"><UiText text="Mørk modus" /></SelectItem>
              </SelectContent>
            </Select>
            <p className="form-hint"><UiText text="Kontaktadressen endrer ikke kontoen du bruker til innlogging." /></p>
            <div role="status" aria-live="polite" className="form-hint">
              {!profileReady ? ui("Henter innstillingene …") : profileAutosave.state === "error" ? ui("Endringene er ikke lagret.") : profileAutosave.state === "saved" ? ui("Alle endringer er lagret") : ui("Lagrer endringer …")}
              {profileAutosave.state === "error" && <Button variant="outline" onClick={profileAutosave.retry}><UiText text="Prøv igjen" /></Button>}
            </div>
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
            <AlertDialogCancel><UiText text="Avbryt" /></AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmation?.confirm()}><UiText text="Bekreft" /></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className={`workspace view-${view}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">NORACRE CRM</p>
            <h1>{t(titleKeys[view])}</h1>
          </div>
          <div className="top-actions">
            {demoMode&&<><Button variant="outline" onClick={onDemoReset}><UiText text="Nullstill demo" /></Button><Button variant="outline" onClick={onDemoClose}><UiText text="Tilbake til min konto" /></Button></>}
            {rolePreview === "Superadmin" && (view === "operations" || view === "superadmin") && <Button variant="outline" onClick={()=>setPartnerPreview(true)}>{t("partner.previewOpen")}</Button>}
            {view === "customers" && (
              <span className={`save-state ${saveState}`}>
                {saveState === "saving"
                  ? ui("Lagrer …")
                  : saveState === "error"
                    ? ui("Kunne ikke lagre")
                    : ui("Alle endringer lagret")}
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
        {demoMode&&<div className="partner-preview-notice" role="status"><strong>{t("partner.previewLabel")}</strong><p>{t("partner.previewHint")}</p></div>}
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
              onContactsChanged={async()=>{const r=await api(`/api/contacts?companyId=${selected.id}`);if(!r.ok)throw Error("Kunne ikke hente kontakter");const d=await r.json();setContacts(d.contacts);setSelectedContactId(current=>d.contacts.some((c:Contact)=>c.id===current)?current:0);await refreshCrmData();}}
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
        {view === "calllists" && (
          <CallListBoundary>
            <CallLists key={activeOrgId}
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
        {view === "marketing" && (
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
        {view === "admin" && canViewAdministration(rolePreview) && (
          <Admin
            members={members}
            role={rolePreview}
            userEmail={user.email}
            supportAccess={supportAccess}
            supportExpiresAt={supportExpiresAt}
            support={support}
            supportRequests={supportRequests}
            approveSupport={approveSupport}
            onImported={refreshCrmData}
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
        {view === "partner" && rolePreview === "Partner" && <PartnerOverview key={activeOrgId} organizationId={activeOrgId}/>}
        {view === "operations" && rolePreview === "Superadmin" && (
          <Operations
            activeOrgId={activeOrgId}
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
            activeOrgId={activeOrgId}
            refreshKey={organizations.length}
            onUserCreated={() => { void api("/api/admin").then(r => r.json()).then(data => { if (data.members) setMembers(data.members); }).catch(() => undefined); }}
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
            <DialogTitle><UiText text="Registrer " />{contactKind.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {selected?.name}<UiText text=" · det tar bare noen sekunder." /></DialogDescription>
          </DialogHeader>
          <div className="contact-kind-row">
            {["Telefon", "E-post", "Møte", "Annet"].map((k) => (
              <button
                key={ui(k)}
                className={contactKind === k ? "active" : ""}
                onClick={() => setContactKind(k)}
              >
                {icon(k)}
                {ui(k)}
              </button>
            ))}
          </div>
          <Label><UiText text="Hvem snakket du med?" /></Label>
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
              <SelectItem value="none"><UiText text="Ingen valgt kontakt" /></SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                  {c.title ? ` · ${c.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label><UiText text="Hva skjedde?" /></Label>
          <Textarea
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            placeholder={ui("Kort notat …")}
          />
          <Label><UiText text="Når skal kunden følges opp igjen?" /></Label>
          <DateTimePicker label={ui("Neste oppfølging")} value={nextAt} onChange={setNextAt}/>
          {nextAt&&<ReminderFields value={nextReminders} onChange={setNextReminders}/>}
          <Button onClick={register}><UiText text="Lagre kontakten" /></Button>
        </DialogContent>
      </Dialog>
      <Dialog open={personOpen} onOpenChange={setPersonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><UiText text="Legg til kontaktperson" /></DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          <Label><UiText text="Navn" /></Label>
          <Input
            value={newContact.name}
            onChange={(e) =>
              setNewContact({ ...newContact, name: e.target.value })
            }
          />
          <Label><UiText text="Stilling" /></Label>
          <Input
            value={newContact.title}
            onChange={(e) =>
              setNewContact({ ...newContact, title: e.target.value })
            }
          />
          <Label><UiText text="Telefon" /></Label>
          <Input
            value={newContact.phone}
            onChange={(e) =>
              setNewContact({ ...newContact, phone: e.target.value })
            }
          />
          <Label><UiText text="E-post" /></Label>
          <Input
            value={newContact.email}
            onChange={(e) =>
              setNewContact({ ...newContact, email: e.target.value })
            }
          />
          <Button onClick={addContact}><UiText text="Legg til kontaktpersonen" /></Button>
        </DialogContent>
      </Dialog>
      <Dialog open={onboardingOpen} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle><UiText text="Velkommen til Noracre CRM" /></DialogTitle>
            <DialogDescription><UiText text="Her er arbeidsflyten du trenger for å komme raskt i gang." /></DialogDescription>
          </DialogHeader>
          <div className="onboarding-grid">
            <div>
              <UsersRound />
              <div>
                <strong><UiText text="Kunder og kontaktpersoner" /></strong>
                <span><UiText text="Søk i Brønnøysundregistrene, registrer aktiviteter og lagre vedlegg." /></span>
              </div>
            </div>
            <div>
              <CalendarCheck2 />
              <div>
                <strong><UiText text="Oppfølging" /></strong>
                <span><UiText text="Planlegg neste steg og få varsler om det som må gjøres." /></span>
              </div>
            </div>
            <div>
              <Phone />
              <div>
                <strong><UiText text="Ringelister" /></strong>
                <span><UiText text="Lag målrettede lister, registrer resultatet og flytt prospekter til kundekort." /></span>
              </div>
            </div>
            <div>
              <BarChart3 />
              <div>
                <strong><UiText text="Tilbud og rapporter" /></strong>
                <span><UiText text="Send tilbud fra kundekortet og følg dine egne salgsresultater." /></span>
              </div>
            </div>
          </div>
          <label className="terms-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span><UiText text="Jeg godtar" />{" "}
              <a href="/vilkar" target="_blank"><UiText text="vilkårene" /></a>{" "}<UiText text="og har lest" />{" "}
              <a href="/personvern" target="_blank"><UiText text="personvernerklæringen" /></a>{" "}<UiText text="og" />{" "}
              <a href="/databehandleravtale" target="_blank"><UiText text="databehandleravtalen" /></a><UiText text=". Dersom jeg handler på vegne av en bedrift, bekrefter jeg at jeg har fullmakt til dette." /></span>
          </label>
          <Button disabled={!accepted} onClick={finishOnboarding}><UiText text="Start Noracre CRM" /></Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function AccessDenied({ message, code }: { message: string; code: string }) {
 const {ui}=useUiTranslation();
  const disabled = code === "USER_DISABLED" || code === "ORGANIZATION_DISABLED";
  return (
    <main className="access-page">
      <section>
        <img className="brand-icon" src="/noracre-app-icon.svg" alt="" />
        <h1>
          {code === "USER_DISABLED"
            ? ui("Bruker deaktivert")
            : code === "ORGANIZATION_DISABLED"
              ? ui("Bedrift deaktivert")
              : ui("Du har ikke tilgang ennå")}
        </h1>
        <p>{message}</p>
        {!disabled && (
          <p><UiText text="Be administratoren i bedriften invitere e-postadressen du logget inn med." /></p>
        )}
        <p className="disabled-support"><UiText text="Kontakt support dersom dette ikke skulle ha skjedd." /></p>
      </section>
    </main>
  );
}

function EmptyCustomers({ add }: { add: () => void }) {
  return (
    <div className="page-pad">
      <section className="surface empty-customers">
        <Building2 />
        <h2><UiText text="Ingen kunder ennå" /></h2>
        <p><UiText text="Legg til den første bedriften manuelt eller hent offentlige bedriftsdata fra Brønnøysundregistrene." /></p>
        <Button onClick={add}>
          <CirclePlus /><UiText text="Legg til første kunde" /></Button>
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
 const {ui}=useUiTranslation();
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
          <CirclePlus /><UiText text="Ny kunde" /></Button>
      )}
      <Dialog open={p.open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle><UiText text="Ny kunde" /></DialogTitle>
            <DialogDescription><UiText text="Søk etter en bedrift, eller legg inn en privatperson separat." /></DialogDescription>
          </DialogHeader>
          <div className="customer-type">
            <button
              className={!person ? "active" : ""}
              onClick={() => setType("Bedrift")}
            >
              <Building2 /><UiText text="Bedrift" /></button>
            <button
              className={person ? "active" : ""}
              onClick={() => setType("Person")}
            >
              <UserPlus /><UiText text="Privatperson" /></button>
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
                  placeholder={ui("Firmanavn eller organisasjonsnummer")}
                />
                <Button onClick={search} disabled={p.busy}>
                  {p.busy ? ui("Søker …") : ui("Søk")}
                </Button>
              </div>
              <p className="form-hint"><UiText text="Søket viser bedrifter fra Brønnøysundregistrene. Enkeltpersonforetak med personnavn vises ikke." /></p>
              {p.results.length > 0 && !manual && (
                <div className="lookup-results">
                  {p.results.map((r) => (
                    <button key={r.orgNumber} onClick={() => choose(r)}>
                      <Building2 />
                      <span>
                        <strong>{r.name}</strong>
                        <small><UiText text="Org: " />{r.orgNumber} · {r.city}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                  <button className="manual-result" onClick={startManual}>
                    <CirclePlus />
                    <span>
                      <strong><UiText text="Finner du ikke riktig bedrift?" /></strong>
                      <small><UiText text="Legg inn bedriften manuelt" /></small>
                    </span>
                    <ChevronRight />
                  </button>
                </div>
              )}
              {searched && !p.busy && !p.results.length && !manual && (
                <div className="manual-entry">
                  <p><UiText text="Fant ingen bedrift som matcher søket." /></p>
                  <Button variant="outline" onClick={startManual}>
                    <CirclePlus /><UiText text="Legg inn manuelt" /></Button>
                </div>
              )}
            </>
          )}
          {showForm && (
            <>
              <div className="form-grid">
                <div className="full">
                  <Label>{person ? ui("Navn *") : ui("Bedriftsnavn *")}</Label>
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
                    <Label><UiText text="Organisasjonsnummer " /><span><UiText text="(valgfritt)" /></span>
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
                  <Label><UiText text="Telefon" /><span><UiText text="(valgfritt)" /></span>
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
                  <Label><UiText text="E-post" /><span><UiText text="(valgfritt)" /></span>
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
              <Button disabled={!p.draft.name?.trim()} onClick={p.save}><UiText text="Legg til kunden" /></Button>
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
 const {ui}=useUiTranslation();
  const tasks = [...p.overdue, ...p.today];
  const recent = [...p.companies].sort((a,b) => (b.lastContactAt || "").localeCompare(a.lastContactAt || "")).slice(0, 6);
  return (
    <div className="page-pad overview-page">
      <section className="welcome">
        <div>
          <p className="eyebrow"><UiText text="DIN ARBEIDSDAG" /></p>
          <h2><UiText text="God dag, " />{p.displayName}.</h2>
          <p>{tasks.length ? `Du har ${tasks.length} ${tasks.length === 1 ? ui("oppfølging som trenger") : ui("oppfølginger som trenger")} deg.` : ui("Alt er fulgt opp. Her er kundene og avtalene dine.")}</p>
        </div>
        <Button variant="outline" onClick={() => p.go("followup")}><UiText text="Se all oppfølging " /><ChevronRight /></Button>
      </section>
      <div className="metric-grid overview-metrics">
        <Metric label={ui("Kunder")} value={p.companies.length} />
        <Metric label={ui("Forfalt")} value={p.overdue.length} tone="red" />
        <Metric label={ui("I dag")} value={p.today.length} tone="green" />
        <Metric label={ui("Kommende")} value={p.upcoming.length} />
      </div>
      <div className="overview-columns">
        <section className="customer-ledger">
          <div className="surface-head"><h3><UiText text="Kundene dine" /></h3><Button variant="ghost" onClick={() => p.go("customers")}><UiText text="Se alle " /><ChevronRight /></Button></div>
          <p className="form-hint"><UiText text="Sist kontaktet" /></p>
          {recent.length ? <div className="ledger-list">{recent.map(company => <button key={company.id} className="ledger-row" onClick={() => p.select(company.id)}>
            <span className="company-icon">{company.name.slice(0,1)}</span>
            <span className="ledger-company"><strong>{company.name}</strong><small>{company.city || company.industry || (company.customerType === "Person" ? <UiText text="Privatperson" /> : <UiText text="Bedrift" />)}</small></span>
            <span className={stageClass[company.stage]}>{ui(company.stage)}</span><ChevronRight size={17}/>
          </button>)}</div> : <div className="ledger-empty"><Building2/><p><UiText text="Kundeboken din er klar." /></p><Button variant="outline" onClick={() => p.go("customers")}><UiText text="Legg til den første kunden" /></Button></div>}
        </section>
        <aside className="overview-agenda" aria-label={ui("Oppfølginger")}>
          <h3><UiText text="Dagens agenda" /></h3>
          <Group title={ui("Forfalt")} items={[...p.overdue].sort((a,b)=>a.dueAt.localeCompare(b.dueAt))} tone="danger" complete={p.complete} select={p.select}/>
          <Group title={ui("I dag")} items={[...p.today].sort((a,b)=>a.dueAt.localeCompare(b.dueAt))} tone="today" complete={p.complete} select={p.select}/>
          {!tasks.length && p.upcoming.length > 0 && <Group title={ui("Neste avtaler")} items={[...p.upcoming].sort((a,b)=>a.dueAt.localeCompare(b.dueAt)).slice(0,3)} complete={p.complete} select={p.select}/>}
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
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [templates, setTemplates] = useState<OfferTemplate[]>([]),
    [templateId, setTemplateId] = useState("new"),
    [contactId, setContactId] = useState("none"),
    [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]),
    [subject, setSubject] = useState(`Tilbud til ${company.name}`),
    [body, setBody] = useState(
      `Hei,\n\nTakk for hyggelig dialog. Vedlagt følger tilbudet til ${company.name}.\n\nVennlig hilsen`,
    );
  useEffect(() => {
    let cancelled=false;
    setTemplates([]);
    apiFetch("/api/offers", {
      headers: { "x-organization-id": String(organizationId) },
    })
      .then((r) => r.json())
      .then((d) => {
        if(!cancelled)setTemplates(d.templates ?? []);
      })
      .catch(() => undefined);
    return ()=>{cancelled=true;};
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
    const first=templates[0];
    setTemplateId(first?String(first.id):"new");
    setSubject(first?.subject ?? `Tilbud til ${company.name}`);
    setBody(first?.body ?? `Hei ${contactName},\n\nTakk for hyggelig dialog. Vedlagt følger tilbudet til ${company.name}.\n\nVennlig hilsen`);
  }, [company.id, templates]);
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
          <Mail size={18} /><UiText text="Tilbud" /></span>
        <strong><UiText text="Lag tilbud fra mal" /></strong>
      </summary>
      <div className="compact-body offer-composer">
        <div className="offer-grid">
          <div>
            <Label><UiText text="Tilbudsmal" /></Label>
            <Select value={templateId} onValueChange={selectTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!templates.length&&<SelectItem value="new"><UiText text="Standardtekst" /></SelectItem>}
                {templates.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label><UiText text="Kontaktperson" /></Label>
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
                <SelectItem value="none"><UiText text="Bedriftens e-post" /></SelectItem>
                {contacts.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Label><UiText text="Emne" /></Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Label><UiText text="E-posttekst" /></Label>
        <Textarea
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="offer-attachments">
          <Label><UiText text="Vedlegg" /></Label>
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
                    <Trash2 /><UiText text="Fjern" /></Button>
                </div>
              ),
          )}
          <label className="attachment-upload">
            <Paperclip />
            <span>{uploading ? ui("Laster opp …") : ui("Last opp nytt vedlegg")}</span>
            <input type="file" disabled={uploading} onChange={upload} />
          </label>
        </div>
        <EmailSend organizationId={organizationId} companyIds={[company.id]} contactId={contact?.id} attachmentIds={selectedAttachmentIds} subject={renderedSubject} message={renderedBody} recipientLabel={email || "Mottakeren mangler e-postadresse"} />
      </div>
    </details>
  );
}
function Metric(p: { label: string; value: number; tone?: string }) {
 const {ui}=useUiTranslation();
  return (
    <div className={`metric ${p.tone ?? ""}`}>
      <span>{ui(p.label)}</span>
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
  onContactsChanged: () => Promise<void>;
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
 const {date,followUpLabel,daysSince,number}=useCrmFormatting();
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [openHistory, setOpenHistory] = useState<Activity | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");
  const [savingHistory, setSavingHistory] = useState(false);
  const historyScope = `${p.organizationId}:${p.selected.id}`;
  const [historyPaging, setHistoryPaging] = useState({scope: historyScope, page: 0, count: p.history.length});
  useEffect(() => {
    setHistoryPaging({scope: historyScope, page: 0, count: p.history.length});
  }, [historyScope, p.history.length]);
  const historyPages = Math.max(1, Math.ceil(p.history.length / 5));
  const historyPage = historyPaging.scope === historyScope && historyPaging.count === p.history.length
    ? Math.min(historyPaging.page, historyPages - 1) : 0;
  const pageHistory = p.history.slice(historyPage * 5, (historyPage + 1) * 5);
  function changeHistoryPage(page: number) {
    setHistoryPaging({scope: historyScope, page, count: p.history.length});
  }
  async function saveHistoryNote() {
    if (!openHistory || savingHistory) return;
    setSavingHistory(true);
    try {
      const response = await apiFetch("/api/activities", {method:"PATCH", headers:{"Content-Type":"application/json","x-organization-id":String(p.organizationId)}, body:JSON.stringify({id:openHistory.id,note:historyDraft})});
      const data=await response.json(); if(!response.ok)throw new Error(data.error||"Notatet kunne ikke lagres.");
      setOpenHistory(data.activity);setHistoryDraft(data.activity.note);toast.success(ui("Notatet er lagret"));
      await p.onFollowupsChanged();
    } catch(error) { toast.error(ui(error instanceof Error?error.message:"Notatet kunne ikke lagres.")); }
    finally { setSavingHistory(false); }
  }
  const c = p.selected,
    currentContacts = p.contacts.filter((x) => x.companyId === c.id),
    person =
      currentContacts.find((x) => x.id === p.selectedContactId),
    isPerson = c.customerType === "Person",
    historyContact = openHistory
      ? p.contacts.find((x) => x.id === openHistory.contactId)
      : null;
  return (
    <section className="content-grid customer-book" aria-label={ui("Kundebok")}>
      <div className="customer-panel">
        <div className="book-heading"><span className="eyebrow"><UiText text="KUNDEBOK" /></span><h2><UiText text="Bedrifter og kontakter" /></h2></div>
        <div className="customer-search-row">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label={ui("Søk etter kunde, kontakt eller telefon")}
              placeholder={ui("Søk etter kunde, kontakt eller telefon …")}
              value={p.query}
              onChange={(e) => p.setQuery(e.target.value)}
            />
            {p.query && (
              <button aria-label={ui("Tøm søk")} onClick={() => p.setQuery("")}>
                <X size={17} />
              </button>
            )}
          </div>
          <Button onClick={p.add}>
            <CirclePlus /><UiText text="Ny kunde" /></Button>
        </div>
        <div className="list-heading">
          <span>
            {p.list.length} {p.list.length === 1 ? "kunde" : "kunder"}
          </span>
        </div>
        <div className="customer-list" aria-label={ui("Kunder")}>
          {!p.list.length && <p className="empty-list"><UiText text="Ingen kunder passer søket ditt." /></p>}
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
                {x.customerType === "Person" && <span><UiText text="Privatperson" /></span>}
                <em className={stageClass[x.stage]}>{ui(x.stage)}</em>
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
            <span className={stageClass[c.stage]}>{ui(c.stage)}</span>
            <h2>{c.name}</h2>
            <p>
              {isPerson
                ? <UiText text="Privatperson" />
                : c.orgNumber
                  ? `Org: ${c.orgNumber}`
                  : ui("Organisasjonsnummer mangler")}
            </p>
          </div>
          {!isPerson && (
            <div className="contact-picker">
              <Label><UiText text="Kontaktperson" /></Label>
              <div>
                <select
                  aria-label={ui("Velg ansatt")}
                  value={person?.id ?? ""}
                  onChange={(e) => p.selectContact(Number(e.target.value))}
                >
                  <option value=""><UiText text="Velg ansatt" /></option>
                  {currentContacts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.title ? ` · ${x.title}` : ""}
                    </option>
                  ))}
                </select>
                <div className="contact-picker-actions">{person?<ContactEditor key={person.id} contact={person} organizationId={p.organizationId} onChanged={p.onContactsChanged}/>:<Button variant="outline" disabled><UiText text="Endre kontaktperson" /></Button>}
                <Button variant="outline" onClick={p.addContact}>
                  <UserPlus /><UiText text="Ny ansatt" /></Button></div>
              </div>
            </div>
          )}
        </div>
        <p className="activity-label"><UiText text="Registrer aktivitet" /></p>
        <div className="contact-actions" role="group" aria-label={ui("Registrer aktivitet")}>
          {["Telefon", "E-post", "Møte", "Annet"].map((k) => (
            <button key={ui(k)} aria-label={`Registrer aktivitet: ${ui(k)}`} onClick={() => p.contact(k)}>
              {icon(k)}
              <span>{ui(k)}</span>
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
                  {ui(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="facts">
          <div>
            <span>{isPerson ? ui("Kunde") : ui("Valgt kontakt")}</span>
            <strong>{person?.name || c.contactName || c.name}</strong>
          </div>
          <div>
            <span><UiText text="Telefon" /></span>
            <strong><PhoneLink phone={person?.phone || c.phone || ""}/></strong>
          </div>
          <div>
            <span><UiText text="E-post" /></span>
            <strong>{person?.email || c.email ? <a href={`mailto:${person?.email || c.email}`}>{person?.email || c.email}</a> : ui("Ikke oppgitt")}</strong>
          </div>
        </div>
        <CustomerFollowups company={c} contacts={currentContacts} organizationId={p.organizationId} onChanged={p.onFollowupsChanged} revision={p.activityRevision}/>
        {!isPerson && (
          <details className="compact-section">
            <summary>
              <span>
                <Building2 size={18} /><UiText text="Bedriftsdata" /></span>
              <strong>
                {[c.city, c.employees != null ? `${c.employees} ansatte` : ""]
                  .filter(Boolean)
                  .join(" · ") || ui("Vis detaljer")}
              </strong>
            </summary>
            <div className="business-grid">
              <div>
                <span><UiText text="Bransje" /></span>
                <strong>{c.industry || ui("Ikke oppgitt")}</strong>
              </div>
              <div>
                <span><UiText text="Sted" /></span>
                <strong>{c.city || ui("Ikke oppgitt")}</strong>
              </div>
              <div>
                <span><UiText text="Ansatte" /></span>
                <strong>{c.employees ?? "–"}</strong>
              </div>
              <div>
                <span><UiText text="Dager siden sist kontakt" /></span>
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
          <summary><span><UiText text="Notater" /></span></summary>
          <div className="compact-body"><Textarea aria-label={ui("Notater")} value={c.note} onChange={(e) => p.update({ note: e.target.value })} rows={3}/></div>
        </details>
        <details className="compact-section">
          <summary>
            <span>
              <Paperclip size={18} /><UiText text="Vedlegg" /></span>
            <strong>
              {p.attachments.length
                ? `${p.attachments.length} filer`
                : ui("Ingen vedlegg")}
            </strong>
          </summary>
          <div className="compact-body">
            <label className="attachment-upload">
              <Paperclip />
              <span>{p.uploading ? ui("Laster opp …") : ui("Legg til vedlegg")}</span>
              <input
                type="file"
                disabled={p.uploading || c.id < 0}
                onChange={p.upload}
              />
            </label>
            {c.id < 0 && (
              <p className="form-hint"><UiText text="Lagre en ekte kunde før du legger til vedlegg." /></p>
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
                    title={ui("Slett vedlegg")}
                    onClick={() => p.removeAttachment(a)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
        <details className="compact-section customer-history" key={historyScope}>
          <summary>
            <span><Clock3 size={18} /><UiText text="Historikk" /></span>
            <strong>{p.history.length} {p.history.length === 1 ? "hendelse" : <UiText text="hendelser" />}</strong>
          </summary>
          {p.history.length ? (
            <div className="history-list">
              {pageHistory.map((a) => {
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
                        {ui(a.kind)}
                        {contact ? ` · ${contact.name}` : ""}
                      </strong>
                      <p>{a.note || ui("Ingen notat")}</p>
                      <span>
                        {date(a.completedAt || a.createdAt, true)}<UiText text=" · registrert av " />{a.createdBy}
                      </span>
                    </div>
                    <ChevronRight />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty-line"><UiText text="Ingen hendelser er registrert ennå." /></p>
          )}
          {historyPages > 1 && <nav className="customer-history-pages" aria-label={ui("Sider i kundehistorikken")}>
            <Button variant="outline" size="sm" disabled={historyPage === 0} onClick={() => changeHistoryPage(historyPage - 1)} aria-label={ui("Forrige side i historikken")}><UiText text="Forrige" /></Button>
            <span aria-live="polite"><UiText text="Side " />{historyPage + 1}<UiText text=" av " />{historyPages}</span>
            <Button variant="outline" size="sm" disabled={historyPage === historyPages - 1} onClick={() => changeHistoryPage(historyPage + 1)} aria-label={ui("Neste side i historikken")}><UiText text="Neste" /></Button>
          </nav>}
        </details>
        <Sheet
          open={!!openHistory}
          onOpenChange={(open) => !open && setOpenHistory(null)}
        >
          <SheetContent className="history-sheet sm:max-w-[42vw]">
            <SheetHeader>
              <SheetTitle>{ui(openHistory?.kind)}</SheetTitle>
              <SheetDescription>
                {openHistory
                  ? ui("{0} · registrert av {1}",{"0":date(openHistory.completedAt || openHistory.createdAt, true),"1":openHistory.createdBy})
                  : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="history-sheet-body">
              <div>
                <span><UiText text="Kontaktperson" /></span>
                <strong>
                  {historyContact?.name || ui("Ingen kontaktperson valgt")}
                </strong>
              </div>
              <div>
                <span><UiText text="Notat" /></span>
                <Textarea aria-label={ui("Rediger notat")} rows={8} value={historyDraft} disabled={savingHistory} onChange={event=>setHistoryDraft(event.target.value)} />
                <div className="history-note-actions"><Button disabled={savingHistory || historyDraft === (openHistory?.note || "")} onClick={saveHistoryNote}>{savingHistory?ui("Lagrer …"):ui("Lagre notat")}</Button><Button variant="outline" disabled={savingHistory} onClick={()=>{setHistoryDraft(openHistory?.note||"");setOpenHistory(null);}}><UiText text="Avbryt" /></Button></div>
              </div>
            </div>
            {openHistory && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="history-delete">
                    <Trash2 /><UiText text="Slett hendelsen" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle><UiText text="Slette denne hendelsen?" /></AlertDialogTitle>
                    <AlertDialogDescription><UiText text="Dette kan ikke angres." /></AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel><UiText text="Avbryt" /></AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        p.removeHistory(openHistory);
                        setOpenHistory(null);
                      }}
                    ><UiText text="Slett" /></AlertDialogAction>
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
 const {ui}=useUiTranslation();
  return (
    <div className="page-pad">
      <Group
        title={ui("Forfalt")}
        items={p.overdue}
        tone="danger"
        complete={p.complete}
        select={p.select}
      />
      <Group
        title={ui("I dag")}
        items={p.today}
        tone="today"
        complete={p.complete}
        select={p.select}
      />
      <Group
        title={ui("Kommende")}
        items={p.upcoming}
        complete={p.complete}
        select={p.select}
      />
      <section className="surface compact">
        <div className="surface-head">
          <h3><UiText text="Ingen oppfølging avtalt" /></h3>
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
            <span><UiText text="Avtal oppfølging" /></span>
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
        <p className="empty-line"><UiText text="Ingen oppfølginger her." /></p>
      )}
    </section>
  );
}
function Task(p: {
  a: Activity;
  complete: (a: Activity) => void;
  select: (id: number) => void;
}) {
 const {date,followUpLabel,daysSince,number}=useCrmFormatting();
 const {ui}=useUiTranslation();
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
          title={ui("Marker oppfølgingen som utført")}
          onClick={() => p.complete(p.a)}
        >
          <Check /><UiText text="Marker som utført" /></Button>
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
 const {ui}=useUiTranslation();
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
              <SelectItem value="all"><UiText text="Alle ansatte" /></SelectItem>
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
            <SelectItem value="today"><UiText text="I dag" /></SelectItem>
            <SelectItem value="week"><UiText text="Denne uken" /></SelectItem>
            <SelectItem value="previous"><UiText text="Forrige uke" /></SelectItem>
            <SelectItem value="year"><UiText text="I år" /></SelectItem>
            <SelectItem value="custom"><UiText text="Valgfri datointervall" /></SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <div>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span><UiText text="til" /></span>
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
            <p className="eyebrow"><UiText text="VALGT PERIODE" /></p>
            <h3><UiText text="Aktivitet og resultater" /></h3>
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
          label={ui("Tilbud sendt")}
          value={
            p.companies.filter(
              (c) => c.stage === "Tilbud sendt" && own(c.assignedTo),
            ).length
          }
        />
        <Metric label={ui("Kunder tapt")} value={vals[6]} tone="red" />
        <Metric
          label="Aktiviteter registrert"
          value={activities.filter((a) => a.completedAt).length}
          tone="green"
        />
      </div>
      <section className="surface">
        <div className="surface-head">
          <h3><UiText text="Aktivitet per medarbeider" /></h3>
        </div>
        {people.length ? (
          people.map((n) => (
            <div className="performance-row" key={n}>
              <div className="avatar">{n.slice(0, 2).toUpperCase()}</div>
              <strong>{n}</strong>
              <span>
                {activities.filter((a) => a.createdBy === n).length}<UiText text=" aktiviteter" /></span>
            </div>
          ))
        ) : (
          <p className="empty-line"><UiText text="Ingen aktiviteter i perioden." /></p>
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
  supportExpiresAt:string;
  support: (v: boolean) => void;
  supportRequests: SupportRequest[];
  approveSupport: (id: number,duration?:"24h"|"untilRevoked") => void;
  onImported: () => Promise<void>;
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
 const {date,followUpLabel,daysSince,number}=useCrmFormatting();
 const {ui}=useUiTranslation();
  return (
    <div className="page-pad admin-grid">

      {p.role !== "Bruker" && (
        <OfferTemplateManager organizationId={p.activeOrgId} />
      )}
      <AdminCard
        eye="KUNDEIMPORT"
        title={ui("Importer data")}
        ico={<FileSpreadsheet />}
      >
        <DataImporter key={p.activeOrgId} organizationId={p.activeOrgId} onImported={p.onImported} />
      </AdminCard>
      <AdminCard
        eye="SIKKERHETSKOPI"
        title={ui("Eksporter alle data")}
        ico={<Download />}
      >
        <p><UiText text="Last ned kunder, kontaktpersoner og historikk som en Excel-fil." /></p>
        <Button variant="outline" onClick={p.exportBackup}>
          <Download /><UiText text="Last ned sikkerhetskopi" /></Button>
      </AdminCard>
      <AdminCard eye="TILGANG" title={ui("Brukere og roller")} ico={<UserPlus />}>
        <div className="member-list">
          {p.members.map((m) => (
            <div key={m.id}>
              <div className="avatar">{m.name.slice(0, 2).toUpperCase()}</div>
              <span>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </span>
              {m.scheduledDisableAt && <small><UiText text="Deaktiveres " />{date(m.scheduledDisableAt,true)}</small>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => p.setMemberStatus(m, m.scheduledDisableAt ? true : !m.active)}
              >
                {m.scheduledDisableAt ? <UiText text="Avbryt deaktivering" /> : m.active ? <UiText text="Deaktiver" /> : <UiText text="Aktiver" />}
              </Button>
            </div>
          ))}
        </div>
        <div className="member-form">
          <Input
            placeholder={ui("Navn")}
            value={p.newMember.name}
            onChange={(e) =>
              p.setNewMember({ ...p.newMember, name: e.target.value })
            }
          />
          <Input
            placeholder={ui("E-post")}
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
              <SelectItem value="Bruker"><UiText text="Bruker" /></SelectItem>
              <SelectItem value="Administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={p.addMember}><UiText text="Aktiver" /></Button>
        </div>
      </AdminCard>
      <AdminCard
        eye="SUPPORT"
        title={ui("Trygg supporttilgang")}
        open={p.supportRequests.length>0||p.supportAccess}
        ico={<Headphones />}
      >
        <p><UiText text="Velg tilgang i 24 timer eller til dere slår den av. Tilgangen kan avsluttes når som helst. Alle endringer loggføres." /></p>
        {p.supportRequests.map((r) => (
          <div className="support-request" key={r.id}>
            <div>
              <strong><UiText text="Support ber om midlertidig tilgang" /></strong>
              <span><UiText text="Sendt av " />{r.requestedBy} · {date(r.createdAt, true)}
              </span>
            </div>
            <div className="support-approval-actions"><Button onClick={() => p.approveSupport(r.id,"24h")}><UiText text="Godkjenn i 24 timer" /></Button><Button variant="outline" onClick={()=>p.approveSupport(r.id,"untilRevoked")}><UiText text="Godkjenn til vi slår av" /></Button></div>
          </div>
        ))}
        <div className="setting-row">
          <div>
            <strong><UiText text="Gi support tilgang" /></strong>
            <span>
              {p.supportAccess ? (p.supportExpiresAt.startsWith("9999") ? ui("Aktiv til dere slår den av") : p.supportExpiresAt ? ui("Tilgang til ")+date(p.supportExpiresAt,true) : ui("Tilgang i 24 timer")) : ui("Ingen har tilgang")}
            </span>
          </div>
          <Switch checked={p.supportAccess} onCheckedChange={p.support} />
        </div>
      </AdminCard>
    </div>
  );
}
function BulkEmail({ companies, organizationId, onSent }: { companies: Company[]; organizationId: number; onSent:()=>void }) {
 const {ui}=useUiTranslation();
  const [emailAt,setEmailAt]=useState("");
  const [sendLater,setSendLater]=useState(false);
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
      <div className="bulk-email">
        <div>
          <Label><UiText text="Kundegruppe" /></Label>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><UiText text="Alle kunder" /></SelectItem>
              <SelectItem value="Ny kunde"><UiText text="Nye kunder" /></SelectItem>
              <SelectItem value="active"><UiText text="Kunder under oppfølging" /></SelectItem>
              <SelectItem value="Vunnet"><UiText text="Vunnede kunder" /></SelectItem>
              <SelectItem value="Tapt"><UiText text="Tapte kunder" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label><UiText text="Emne" /></Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={ui("Skriv emne")}
          />
        </div>
        <div className="full">
          <Label><UiText text="Melding" /></Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(ui(e.target.value))}
            rows={4}
            placeholder={ui("Skriv meldingen …")}
          />
        </div>
        <div className="full email-attachments">
          <Label htmlFor="bulk-email-files"><UiText text="Vedlegg" /></Label>
          <Input id="bulk-email-files" type="file" multiple onChange={event=>{const next=[...files,...Array.from(event.target.files??[])];event.target.value="";if(next.length>10||next.reduce((sum,f)=>sum+f.size,0)>10*1024*1024)return toast.error(ui("Maks 10 vedlegg og 10 MB samlet."));setFiles(next);}} />
          {files.map((file,index)=><div className="offer-file" key={`${file.name}-${index}`}><span>{file.name} · {fileSize(file.size)}</span><Button size="sm" variant="ghost" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X/><UiText text="Fjern" /></Button></div>)}
          <p className="form-hint"><UiText text="Maks 10 vedlegg, 10 MB samlet og 49 mottakere per utsending." /></p>
        </div>
        <div className="full email-timing"><Label><UiText text="Sendetidspunkt" /></Label><Select value={sendLater?"later":"now"} onValueChange={v=>{setSendLater(v==="later");setEmailAt("");}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="now"><UiText text="Send nå" /></SelectItem><SelectItem value="later"><UiText text="Planlegg til senere" /></SelectItem></SelectContent></Select>{sendLater&&<><DateTimePicker label={ui("Send e-post")} value={emailAt} onChange={setEmailAt}/><p className="form-hint"><UiText text="Velg dato og tid. E-posten sendes automatisk selv om CRM-et er lukket. Tidssone: " />{Intl.DateTimeFormat().resolvedOptions().timeZone}.</p></>}</div>
        <div className="bulk-email-foot">
          <span>{emails.length}<UiText text=" mottakere med e-postadresse" /></span>
          <EmailSend organizationId={organizationId} companyIds={sendLater&&!emailAt?[]:targets.map(c=>c.id)} files={files} subject={subject} message={message} bulk scheduledAt={sendLater?emailAt:undefined} onSent={onSent} recipientLabel={`${emails.length} mottakere · ${segment === "all"?"Alle kunder":segment}`} />
        </div>
      </div>

  );
}
function OfferTemplateManager({ organizationId }: { organizationId: number }) {
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

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
    if (!draft.name.trim()) return toast.error(ui("Gi malen et navn"));
    const r = await apiFetch("/api/offers", {
        method: draft.id ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
          "x-organization-id": String(organizationId),
        },
        body: JSON.stringify(draft),
      }),
      d = await r.json();
    if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke lagre malen"));
    setTemplates((rows) =>
      draft.id
        ? rows.map((row) => (row.id === draft.id ? d.template : row))
        : [d.template, ...rows],
    );
    setDraft(blank);
    toast.success(ui("Tilbudsmalen er lagret"));
  }
  async function remove(id: number) {
    const r = await apiFetch(`/api/offers?id=${id}`, {
      method: "DELETE",
      headers: { "x-organization-id": String(organizationId) },
    });
    if (!r.ok) return toast.error(ui("Kunne ikke slette malen"));
    setTemplates((rows) => rows.filter((row) => row.id !== id));
    if (draft.id === id) setDraft(blank);
    toast.success(ui("Tilbudsmalen er slettet"));
  }
  return (
    <AdminCard eye="KUN FOR ADMINISTRATOR" title={ui("Tilbudsmaler")} ico={<Mail />}>
      <p><UiText text="Lag og vedlikehold malene som brukes på kundekortet." /></p>
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
              <Trash2 /><UiText text="Slett" /></Button>
          </div>
        ))}
      </div>
      <div className="template-editor">
        <Label><UiText text="Navn på mal" /></Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Label><UiText text="Emne" /></Label>
        <Input
          value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        />
        <Label><UiText text="E-posttekst" /></Label>
        <Textarea
          rows={7}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <p className="form-hint"><UiText text="Bruk " />{"{{bedrift}}"}<UiText text=" og " />{"{{kontaktperson}}"}<UiText text=". Verdiene fylles inn før sending." /></p>
        <div>
          <Button onClick={save}>
            {draft.id ? ui("Lagre endringer") : ui("Opprett mal")}
          </Button>
          {draft.id ? (
            <Button variant="outline" onClick={() => setDraft(blank)}><UiText text="Avbryt" /></Button>
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
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [unitPrice,setUnitPrice] = useState(agreedPrice);
  const [purchaseBusy,setPurchaseBusy] = useState(false);
  useEffect(()=>setUnitPrice(agreedPrice),[agreedPrice]);
  const [country,setCountry]=useState<RegisterCountry>("NO"),[selectedListId,setSelectedListId]=useState<number|null>(null),[listRefresh,setListRefresh]=useState(0),[listName,setListName]=useState(""),[internationalQuery,setInternationalQuery]=useState(""),[internationalLocation,setInternationalLocation]=useState(""),[internationalIndustry,setInternationalIndustry]=useState("");
  const [entries, setEntries] = useState<CallListEntry[]>(
      [],
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
        reminderMinutes: [15] as number[],
        meetingNote: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    }),
    [busy, setBusy] = useState(false),
    [loadingEntries, setLoadingEntries] = useState(active),
    [purchaseOpen, setPurchaseOpen] = useState(false),
    [licensedMemberIds, setLicensedMemberIds] = useState<number[]>([]),
    [options, setOptions] = useState<CallListOptions>(
      {
        counties: [],
        municipalities: [],
        industries: [],
        organizationForms: organizationFormFallbackOptions,
      },
    ),
    [filters, setFilters] = useState(defaultCallListFilters);
  const callListImportRef=useRef<HTMLInputElement>(null);
  const headcountImportRef=useRef<HTMLInputElement>(null);
  const [sourceReady,setSourceReady]=useState(true);
  const [employeeListMin,setEmployeeListMin]=useState(""),[employeeListMax,setEmployeeListMax]=useState(""),[includeUnknownEmployees,setIncludeUnknownEmployees]=useState(false);
  const [listCityQuery,setListCityQuery]=useState(""),[listIndustryQuery,setListIndustryQuery]=useState("");
  const hasEmployeeBounds=employeeListMin!==""||employeeListMax!=="";
  const hasListFilters=hasEmployeeBounds||listCityQuery.trim()!==""||listIndustryQuery.trim()!=="";
  const visibleEntries=entries.filter(entry=>{
    if(listCityQuery&&!entry.city.toLowerCase().includes(listCityQuery.trim().toLowerCase()))return false;
    if(listIndustryQuery&&!entry.industry.toLowerCase().includes(listIndustryQuery.trim().toLowerCase()))return false;
    if(!hasEmployeeBounds)return true;
    if(entry.employees==null)return includeUnknownEmployees;
    return (employeeListMin===""||entry.employees>=Number(employeeListMin))&&(employeeListMax===""||entry.employees<=Number(employeeListMax));
  });
  async function fetchAllListRows(listId:number,view:"queue"|"history"="queue"){
    const collected:CallListEntry[]=[];
    for(let offset=0;offset<100000;offset+=1000){
      const response=await apiFetch(`/api/call-lists?listId=${listId}&view=${view}&offset=${offset}`,{headers:{"x-organization-id":String(organizationId)}});
      const payload=await response.json().catch(()=>({error:"Ugyldig svar fra serveren."}));
      if(!response.ok)throw new Error(payload.error??"Kunne ikke hente ringelisten.");
      if(!Array.isArray(payload.entries))throw new Error("Ringelisten svarte med ugyldige data.");
      collected.push(...payload.entries);
      if(!payload.hasMore)return collected;
      if(payload.entries.length!==1000)throw new Error("Ringelisten kunne ikke leses fullstendig.");
    }
    throw new Error("Ringelisten er for stor for denne visningen.");
  }
  useEffect(()=>{if(!active)return;let cancelled=false;apiFetch("/api/call-list-options",{headers:{"x-organization-id":String(organizationId)}}).then(async r=>{if(!r.ok)throw Error("Kunne ikke hente filtrene");return r.json();}).then(d=>{if(!cancelled&&Array.isArray(d.counties)&&Array.isArray(d.municipalities)&&Array.isArray(d.industries))setOptions({...d,organizationForms:Array.isArray(d.organizationForms)&&d.organizationForms.length?d.organizationForms:organizationFormFallbackOptions});}).catch(()=>undefined);return()=>{cancelled=true;};},[active,organizationId]);
  useEffect(()=>{let cancelled=false;setEntries([]);setHistory([]);setHistoryLoaded(false);if(!active||!selectedListId){setLoadingEntries(false);setHistoryLoaded(true);return;}setLoadingEntries(true);fetchAllListRows(selectedListId).then(rows=>{if(!cancelled)setEntries(rows);}).catch(e=>{if(!cancelled)toast.error(e.message);}).finally(()=>{if(!cancelled)setLoadingEntries(false);});return()=>{cancelled=true;};},[active,organizationId,selectedListId]);
  useEffect(() => {
    if (!purchaseOpen || !canManageModules(role)) return;
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
    if (purchaseBusy || !canManageModules(role)) return;
    if (unitPrice == null) return toast.error(ui("Pris er ikke avtalt. Kontakt Noracre."));
    if (!licensedMemberIds.length) return toast.error(ui("Velg minst én bruker"));
    setPurchaseBusy(true);
    try {
      const r = await apiFetch("/api/admin", {method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"moduleStatus",moduleKey:"ringelister",membershipIds:licensedMemberIds,acceptedPrice:unitPrice})});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Kunne ikke aktivere modulen");
      onActivated(Boolean(d.currentUserActive));
      setPurchaseOpen(false);
      toast.success(ui("Modullisensene er oppdatert"));
    } catch (error) { toast.error(ui(error instanceof Error ? error.message : "Kunne ikke aktivere modulen")); }
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
            country,listName:listName.trim()||undefined,
            ...(country==="NO"?filters:{
              count:filters.count,
              query:internationalQuery,
              location:internationalLocation,
              industry:internationalIndustry,
              establishedFrom:country==="GB"||country==="IE"?filters.establishedFrom:"",
              establishedTo:country==="GB"||country==="IE"?filters.establishedTo:"",
            }),
          }),
        }),
        d = await r.json().catch(()=>({error:`Serveren svarte med HTTP ${r.status}. Prøv igjen senere.`}));
      if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke lage ringelisten"));
      setSelectedListId(d.list?.id??null);setListRefresh(n=>n+1);
      setEntries(d.entries ?? []);
      callListCache.set(organizationId, {
        entries: d.entries ?? [],
        options,
        loadedAt: Date.now(),
      });
      toast.success(ui(`Ny ringeliste med ${d.added ?? 0} bedrifter er klar`));
      if(d.added<filters.count)toast.info(ui(`Fant ${d.added} av ${filters.count} ønskede bedrifter. Du kan utvide filtrene for flere treff.`));
    } catch(error) { toast.error(ui(error instanceof Error?error.message:"Kunne ikke hente bedriftene.")); } finally {
      setBusy(false);
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    if(file.size>5*1024*1024)return toast.error(ui("Importfilen kan være maks 5 MB."));
    setBusy(true);
    let imported=0,listId:number|null=null;
    try{
      const book=XLSX.read(await file.arrayBuffer(),{sheetRows:1001,sheets:0});
      const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(book.Sheets[book.SheetNames[0]],{defval:""});
      const rows=mapProspectRows(raw.slice(0,1000));
      if(!rows.length)throw new Error("Fant ingen bedriftsnavn i importfilen. Bruk en kolonne som heter Company Name eller Supplier Name.");
      let allRows:CallListEntry[]=[];
      // A 100-row upload needs 25 INSERT statements, below the 50-query free-tier Worker limit.
      for(let i=0;i<rows.length;i+=100){
        const batch=rows.slice(i,i+100);
        const response=await apiFetch("/api/call-lists",{method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"import",country,rows:batch,listId:listId??undefined,listName:listName.trim()||file.name.replace(/\.[^.]+$/,"")})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error??"Kunne ikke importere ringelisten.");
        listId=result.list?.id??listId;imported+=result.added??0;allRows=allRows.concat(result.entries??[]);
      }
      setSelectedListId(listId);setListRefresh(n=>n+1);setEntries(allRows);
      callListCache.delete(organizationId);
      toast.success(ui(`${imported} bedrifter ble importert`));
      if(raw.length===1000)toast.info(ui("Filen ble begrenset til de første 1 000 radene."));
    }catch(error){if(listId){setSelectedListId(listId);setListRefresh(n=>n+1);callListCache.delete(organizationId);}toast.error(ui((error instanceof Error?error.message:"Kunne ikke importere")+" "+(imported?`${imported} bedrifter ble allerede lagret i listen.`:"")));}
    finally{setBusy(false);}
  }
  async function importHeadcountFile(e: ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value="";
    if(!file||!selectedListId)return;
    if(file.size>5*1024*1024)return toast.error(ui("Importfilen kan være maks 5 MB."));
    setBusy(true);
    let updated=0,unmatched=0;
    try{
      const book=XLSX.read(await file.arrayBuffer(),{sheetRows:1001,sheets:0});
      const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(book.Sheets[book.SheetNames[0]],{defval:""});
      const rows=mapHeadcountRows(raw.slice(0,1000));
      if(!rows.length)throw new Error("Fant ingen gyldige registreringsnumre og ansattall. Filen må ha Company Number og Employees.");
      for(let i=0;i<rows.length;i+=25){
        const response=await apiFetch("/api/call-lists",{method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"enrichEmployees",country,listId:selectedListId,rows:rows.slice(i,i+25)})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error??"Kunne ikke oppdatere antall ansatte.");
        updated+=result.updated??0;unmatched+=result.unmatched??0;
      }
      setEntries(await fetchAllListRows(selectedListId));
      callListCache.delete(organizationId);
      toast.success(ui(`${updated} bedriftsoppføringer fikk oppdatert ansattall.`));
      if(unmatched)toast.info(ui(`${unmatched} registreringsnumre fra filen finnes ikke i denne listen.`));
    }catch(error){toast.error(ui(error instanceof Error?error.message:"Kunne ikke importere ansattall."));}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{
      if(!active||!selectedListId)return;
      try {const rows=await fetchAllListRows(selectedListId);if(cancelled)return;setEntries(rows);setHistory([]);setHistoryLoaded(false);
        const previous=await fetchAllListRows(selectedListId,"history");
        if(!cancelled){setHistory(previous);setHistoryLoaded(true);}
      }catch{if(!cancelled)toast.error(ui("Kunne ikke oppdatere navnene i ringelisten."));}
    };
    window.addEventListener("crm-profile-updated",refresh);
    return ()=>{cancelled=true;window.removeEventListener("crm-profile-updated",refresh);};
  },[active,organizationId,selectedListId]);
  async function loadHistory() {
    if (historyLoaded || !selectedListId) return;
    try {
      const rows=await fetchAllListRows(selectedListId,"history");
      setHistory(rows);
      setHistoryLoaded(true);
    }catch(error){
      toast.error(ui(error instanceof Error?error.message:"Kunne ikke hente ringehistorikken."));
    }
  }
  async function saveStatus(
    row: CallListEntry,
    status: string,
    extra: Record<string, string | number[]> = {},
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
      toast.error(ui(d.error ?? "Kunne ikke oppdatere bedriften"));
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
      toast.success(ui("Møtet er lagt til under kunder og oppfølging"));
    return d;
  }
  function update(row: CallListEntry, status: string) {
    if (status === "Møte booket") {
      setMeetingEntry(row);
      setMeeting({
        meetingAt: "",
        reminderMinutes: [15] as number[],
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
        reminderMinutes: [15] as number[],
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
      return toast.error(ui(d.error ?? "Kunne ikke legge til kunden"));
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
        <ModuleShowcase moduleKey="ringelister" role={role} price={unitPrice} onPurchase={() => setPurchaseOpen(true)} />
        {canManageModules(role)&&<SavedCallListManager organizationId={organizationId} role={role} members={members} currentMembershipId={currentMembershipId} country={country} onCountryChange={setCountry} selectedListId={selectedListId} onSelect={setSelectedListId} refreshKey={listRefresh} onSourceReadyChange={setSourceReady}/>}
        <Dialog open={purchaseOpen && canManageModules(role)} onOpenChange={setPurchaseOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle><UiText text="Aktiver Ringelister" /></DialogTitle>
              <DialogDescription><UiText text="Velg hvilke ansatte som skal ha modulen. Avtalt pris er " />{unitPrice}<UiText text=" kr per bruker per måned eks. mva." /></DialogDescription>
            </DialogHeader>
            <div className="module-member-list">
              <div className="module-member-all">
                <strong><UiText text="Aktive brukere" /></strong>
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
                ><UiText text="Alle" /></Button>
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
                {licensedMemberIds.length === 1 ? "bruker" : <UiText text=" brukere" />}
              </span>
              <strong>{unitPrice == null ? ui("Pris ikke avtalt") : `${licensedMemberIds.length * unitPrice} kr/mnd.`}</strong>
            </div>
            <Button onClick={activate} disabled={purchaseBusy || unitPrice == null || !licensedMemberIds.length}><UiText text="Bekreft kjøp og aktiver" /></Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  return (
    <div className="page-pad call-lists">
      <section className="surface">
        <div className="operations-head">
          <div>
            <p className="eyebrow"><UiText text="RINGELISTER" /></p>
            <h3><UiText text="Lag en målrettet liste" /></h3>
          </div>
          <div className="offer-actions call-list-actions">
            {canManageModules(role) && (
              <Button variant="outline" onClick={() => setPurchaseOpen(true)}>
                <UsersRound /><UiText text="Administrer brukere" /></Button>
            )}
            <Button variant="outline" disabled={busy} onClick={()=>callListImportRef.current?.click()}><Upload size={18}/><UiText text="Importer egen liste" /></Button>
            <Button variant="outline" disabled={busy||!selectedListId} onClick={()=>headcountImportRef.current?.click()}><Upload size={18}/>Oppdater ansatte fra CSV/Excel</Button>
            <input ref={callListImportRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={importFile}/>
            <input ref={headcountImportRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={importHeadcountFile}/>

          </div>
        </div>
        <Dialog open={purchaseOpen && canManageModules(role)} onOpenChange={setPurchaseOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle><UiText text="Ringelister for ansatte" /></DialogTitle>
              <DialogDescription><UiText text="Velg hvem som skal ha modulen. Prisen oppdateres når du lagrer." /></DialogDescription>
            </DialogHeader>
            <div className="module-member-list">
              <div className="module-member-all">
                <strong><UiText text="Aktive brukere" /></strong>
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
                ><UiText text="Alle" /></Button>
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
                {licensedMemberIds.length === 1 ? "bruker" : <UiText text=" brukere" />}
              </span>
              <strong>{unitPrice == null ? ui("Pris ikke avtalt") : `${licensedMemberIds.length * unitPrice} kr/mnd.`}</strong>
            </div>
            <Button onClick={activate} disabled={purchaseBusy || unitPrice == null || !licensedMemberIds.length}><UiText text="Lagre og bekreft pris" /></Button>
          </DialogContent>
        </Dialog>
        <SavedCallListManager organizationId={organizationId} role={role} members={members} currentMembershipId={currentMembershipId} country={country} onCountryChange={setCountry} selectedListId={selectedListId} onSelect={setSelectedListId} refreshKey={listRefresh} onSourceReadyChange={setSourceReady}/>
        <div className="call-filter-grid"><div><Label htmlFor="new-list-name">Navn på ny ringeliste</Label><Input id="new-list-name" value={listName} maxLength={120} placeholder="F.eks. Byggfirmaer i London" onChange={e=>setListName(e.target.value)}/></div></div>
        {country!=="NO"&&<div className="call-filter-grid"><div><Label>Bedriftsnavn / søkeord</Label><Input value={internationalQuery} onChange={e=>setInternationalQuery(e.target.value)}/></div>{country!=="NZ"&&country!=="NG"&&<div><Label>{country==="AU"?"Delstat eller postnummer":"Sted"}</Label><Input value={internationalLocation} onChange={e=>setInternationalLocation(e.target.value)}/></div>}{(country==="GB"||country==="IE")&&<div><Label>{country==="GB"?"SIC-kode":"NACE-kode"}</Label><Input value={internationalIndustry} onChange={e=>setInternationalIndustry(e.target.value)}/></div>}{(country==="GB"||country==="IE")&&<><div><Label>Etablert fra</Label><Input aria-label="Internasjonalt etablert fra" type="date" value={filters.establishedFrom} onChange={e=>setFilters({...filters,establishedFrom:e.target.value})}/></div><div><Label>Etablert til</Label><Input aria-label="Internasjonalt etablert til" type="date" value={filters.establishedTo} onChange={e=>setFilters({...filters,establishedTo:e.target.value})}/></div></>}<div><Label>Antall bedrifter</Label><NormalizedNumberInput type="number" min={1} max={100} value={filters.count} onChange={e=>setFilters({...filters,count:Number(e.target.value)})}/></div></div>}
        <fieldset className="call-filter-fields" hidden={country!=="NO"} disabled={busy||country!=="NO"}><legend className="sr-only"><UiText text="Søkefiltre" /></legend><div className="call-filter-grid">
          <div>
            <Label><UiText text="Min. ansatte" /></Label>
            <NormalizedNumberInput
              type="number"
              min="0"
              value={filters.minEmployees}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setFilters({ ...filters, minEmployees: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label><UiText text="Maks ansatte" /></Label>
            <NormalizedNumberInput
              type="number"
              min="0"
              placeholder={ui("Ingen grense")}
              value={filters.maxEmployees===1000000?"":filters.maxEmployees}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setFilters({ ...filters, maxEmployees: e.target.value===""?1000000:Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label><UiText text="Sted" /></Label>
            <CallListMultiPicker values={filters.locationCodes} onChange={locationCodes=>setFilters({...filters,locationCodes})} groups={[{heading:'Fylker',options:options.counties.map(x=>({...x,value:'county:'+x.value}))},{heading:'Byer og kommuner',options:options.municipalities}]} placeholder={ui("Søk etter sted")} allLabel="Hele Norge" noun={ui("steder")}/>
          </div>
          <div><Label><UiText text="Bransje" /></Label><CallListMultiPicker values={filters.industryCodes} onChange={industryCodes=>setFilters({...filters,industryCodes})} groups={[{heading:'Bransjer',options:options.industries}]} placeholder={ui("Søk etter bransje")} allLabel={ui("Alle bransjer")} noun={ui("bransjer")}/></div>
          <div>
            <Label><UiText text="Antall" /></Label>
            <NormalizedNumberInput
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
            <Label><UiText text="Organisasjonsform" /></Label>
            <CallListMultiPicker values={filters.organizationForms} onChange={organizationForms=>setFilters({...filters,organizationForms})} groups={[{heading:'Vanlige organisasjonsformer',options:options.organizationForms.filter(x=>['AS','ENK'].includes(x.value))},{heading:'Andre organisasjonsformer',options:options.organizationForms.filter(x=>!['AS','ENK'].includes(x.value))}]} placeholder={ui("Søk etter organisasjonsform")} allLabel={ui("Alle organisasjonsformer")} noun={ui("organisasjonsformer")} allMeansEmpty={false}/>
          </div>
          <div><Label htmlFor="call-established-from"><UiText text="Etablert fra" /></Label><NorwegianDateInput id="call-established-from" label={ui("Etablert fra")} value={filters.establishedFrom} onChange={establishedFrom=>setFilters({...filters,establishedFrom})}/></div>
          <div><Label htmlFor="call-established-to"><UiText text="Etablert til" /></Label><NorwegianDateInput id="call-established-to" label={ui("Etablert til")} value={filters.establishedTo} onChange={establishedTo=>setFilters({...filters,establishedTo})}/></div>
        </div>
        <div className="contact-requirements">
          <label>
            <input
              type="checkbox"
              checked={filters.requirePhone}
              onChange={(e) =>
                setFilters({ ...filters, requirePhone: e.target.checked })
              }
            /><UiText text="Må ha telefonnummer" /></label>
          <label>
            <input
              type="checkbox"
              checked={filters.requireEmail}
              onChange={(e) =>
                setFilters({ ...filters, requireEmail: e.target.checked })
              }
            /><UiText text="Må ha e-postadresse" /></label>
          <Button onClick={generate} disabled={busy}>
            <Search />
            {busy ? ui("Lager liste …") : ui("Hent bedrifter")}
          </Button>
        </div>
        </fieldset>
        {country!=="NO"&&<Button onClick={generate} disabled={busy||!sourceReady}><Search/>{busy?ui("Lager liste …"):sourceReady?ui("Hent bedrifter"):ui("Automatisk søk ikke aktivert")}</Button>}
      </section>
      <section className="surface">
        <Tabs
          defaultValue="queue"
          onValueChange={(value) => {
            if (value === "history") void loadHistory();
          }}
        >
          <TabsList>
            <TabsTrigger value="queue"><UiText text="Ringeliste (" />{entries.length})
            </TabsTrigger>
            <TabsTrigger value="history"><UiText text="Historikk" /></TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
            <div className="call-filter-grid" aria-label="Filtrer bedrifter som allerede er i ringelisten">
              <div><Label htmlFor="list-employee-min">Min. ansatte i listen</Label><NormalizedNumberInput id="list-employee-min" type="number" min="0" value={employeeListMin} placeholder="Ingen grense" onChange={e=>setEmployeeListMin(e.target.value)}/></div>
              <div><Label htmlFor="list-employee-max">Maks ansatte i listen</Label><NormalizedNumberInput id="list-employee-max" type="number" min="0" value={employeeListMax} placeholder="Ingen grense" onChange={e=>setEmployeeListMax(e.target.value)}/></div>
              <div><Label htmlFor="list-city">By / fylke / provins</Label><Input id="list-city" value={listCityQuery} onChange={e=>setListCityQuery(e.target.value)} placeholder="F.eks. Dublin eller Lusaka"/></div>
              <div><Label htmlFor="list-industry">Bransje / sektor</Label><Input id="list-industry" value={listIndustryQuery} onChange={e=>setListIndustryQuery(e.target.value)} placeholder="F.eks. construction eller 6201"/></div>
              {hasEmployeeBounds&&<label className="form-hint"><input type="checkbox" checked={includeUnknownEmployees} onChange={e=>setIncludeUnknownEmployees(e.target.checked)}/> Vis også bedrifter med ukjent antall ansatte</label>}
            </div>
            {hasListFilters&&<p className="form-hint">Viser {visibleEntries.length} av {entries.length} bedrifter. Filteret bruker bare ansattall som finnes i ringelisten, for eksempel fra en importert fil. Bedrifter uten oppgitt ansattall blir skjult med mindre du velger å vise dem.</p>}
            {loadingEntries ? (
              <div className="list-skeleton">
                <i />
                <i />
                <i />
              </div>
            )  : visibleEntries.length ? (
              <ProspectRows rows={visibleEntries} update={update} />
            ) : (
              <p className="empty-line"><UiText text="Ingen bedrifter som matcher filteret, eller listen er tom." /></p>
            )}
          </TabsContent>
          <TabsContent value="history">
            <div className="history-search">
              <Search />
              <Input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder={ui("Søk i bedrift, status eller medarbeider")}
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
              <p className="empty-line"><UiText text="Henter historikk …" /></p>
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
            <DialogTitle><UiText text="Book møte" /></DialogTitle>
            <DialogDescription><UiText text="Bedriften legges samtidig til under Kunder." /></DialogDescription>
          </DialogHeader>
          <div className="meeting-form">
            <Label><UiText text="Dato og tidspunkt" /></Label>
            <DateTimePicker label={ui("Møtetidspunkt")} value={meeting.meetingAt} onChange={value => setMeeting({ ...meeting, meetingAt: value })}/>
            <ReminderFields value={meeting.reminderMinutes} onChange={reminderMinutes=>setMeeting({...meeting,reminderMinutes})}/>
            <Label><UiText text="Kontaktperson" /></Label>
            <Input
              value={meeting.contactName}
              onChange={(e) =>
                setMeeting({ ...meeting, contactName: e.target.value })
              }
              placeholder={ui("Navn")}
            />
            <Label><UiText text="E-post" /></Label>
            <Input
              value={meeting.contactEmail}
              onChange={(e) =>
                setMeeting({ ...meeting, contactEmail: e.target.value })
              }
            />
            <Label><UiText text="Telefon" /></Label>
            <Input
              value={meeting.contactPhone}
              onChange={(e) =>
                setMeeting({ ...meeting, contactPhone: e.target.value })
              }
            />
            <Label htmlFor="call-meeting-note"><UiText text="Hva skal møtet handle om?" /></Label>
            <Textarea id="call-meeting-note" value={meeting.meetingNote} maxLength={5000} rows={3} placeholder={ui("Tema, behov og det dere skal snakke om …")} onChange={e=>setMeeting({...meeting,meetingNote:e.target.value})}/>
            <Button disabled={meetingSaving || !meeting.meetingAt}
              onClick={async () => {
                if (!meetingEntry || meetingSaving) return;
                setMeetingSaving(true);
                try {
                  const result=await saveStatus(meetingEntry, "Møte booket", meeting);
                  if(!result?.company)return;
                  setMeetingEntry(null);
                  setBookedCustomer(result.company);
                } catch { toast.error(ui("Møtet kunne ikke lagres. Prøv igjen.")); }
                finally { setMeetingSaving(false); }
              }}
            >{meetingSaving?ui("Lagrer møte …"):ui("Lagre møte")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(bookedCustomer)} onOpenChange={open=>{if(!open)setBookedCustomer(null);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle><UiText text="Møtet er opprettet" /></DialogTitle><DialogDescription><UiText text="Møtet med " />{bookedCustomer?.name}<UiText text=" er lagret. Hva vil du gjøre videre?" /></DialogDescription></DialogHeader>
          <div className="offer-actions"><Button variant="outline" onClick={()=>setBookedCustomer(null)}><UiText text="Fortsett her" /></Button><Button onClick={()=>{if(bookedCustomer)onGoToCustomer(bookedCustomer);setBookedCustomer(null);}}><UiText text="Gå til kundekortet" /></Button></div>
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
            <DialogTitle><UiText text="Registrer sendt tilbud" /></DialogTitle>
            <DialogDescription><UiText text="Kundekortet opprettes med kontaktinformasjonen du legger inn." /></DialogDescription>
          </DialogHeader>
          <div className="meeting-form">
            <Label><UiText text="Kontaktperson" /></Label>
            <Input
              value={meeting.contactName}
              onChange={(e) =>
                setMeeting({ ...meeting, contactName: e.target.value })
              }
              placeholder={ui("Navn")}
            />
            <Label><UiText text="E-post" /></Label>
            <Input
              value={meeting.contactEmail}
              onChange={(e) =>
                setMeeting({ ...meeting, contactEmail: e.target.value })
              }
            />
            <Label><UiText text="Telefon" /></Label>
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
            ><UiText text="Registrer tilbudet" /></Button>
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
            <DialogTitle><UiText text="Kundekortet er opprettet" /></DialogTitle>
            <DialogDescription>
              {createdCustomer?.name}<UiText text=" er registrert med status «Tilbud sendt»." /></DialogDescription>
          </DialogHeader>
          <div className="offer-actions">
            <Button variant="outline" onClick={() => setCreatedCustomer(null)}><UiText text="Fortsett i ringelisten" /></Button>
            <Button
              onClick={() => {
                if (createdCustomer) onGoToCustomer(createdCustomer);
                setCreatedCustomer(null);
              }}
            ><UiText text="Gå til kundekort" /></Button>
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
            <DialogTitle><UiText text="Legg til " />{customerChoice?.name}?</DialogTitle>
            <DialogDescription><UiText text="Kundekortet opprettes med bedriftsinformasjonen fra ringelisten." /></DialogDescription>
          </DialogHeader>
          <div className="offer-actions">
            <Button variant="outline" onClick={() => setCustomerChoice(null)}><UiText text="Fortsett i ringelisten" /></Button>
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
                ? ui("Oppretter kundekort …")
                : <UiText text="Gå til kundekort" />}
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
 const {ui}=useUiTranslation();
  return (
    <div className="prospect-list">
      {rows.map((row) => (
        <div className="prospect-row" key={row.id}>
          <div>
            <strong>{row.name}</strong>
            <small><UiText text="Org: " />{row.orgNumber} · {row.city || ui("Ukjent sted")}
            </small>
          </div>
          <div>
            <span>{row.industry || ui("Ukjent bransje")}</span>
            <small>{row.employees == null ? ui("Ansatte: ikke oppgitt") : `${row.employees} ansatte`}</small>
          </div>
          <div className="prospect-contact">
            {row.phone ? (
              <PhoneLink phone={row.phone}/>
            ) : (
              <span><UiText text="Telefon mangler" /></span>
            )}
            {row.email ? (
              <a href={`mailto:${row.email}`}>{row.email}</a>
            ) : (
              <span><UiText text="E-post mangler" /></span>
            )}
            {row.status !== "Ny" && (
              <small>
                {(row as CallListEntry).handledBy
                  ? `Behandlet av ${(row as CallListEntry).handledBy}`
                  : ui("Medarbeider ikke registrert på eldre aktivitet")}
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
                <SelectItem value="Ny"><UiText text="Ny" /></SelectItem>
                <SelectItem value="Ringte – ikke svar"><UiText text="Ringte – ikke svar" /></SelectItem>
                <SelectItem value="Kontaktet"><UiText text="Kontaktet" /></SelectItem>
                <SelectItem value="Møte booket"><UiText text="Møte booket" /></SelectItem>
                <SelectItem value="Tilbud sendt"><UiText text="Tilbud sendt" /></SelectItem>
                <SelectItem value="Lagt til som kunde"><UiText text="Legg til som kunde" /></SelectItem>
                <SelectItem value="Ikke aktuell"><UiText text="Ikke aktuell" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
function Prospects() {
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

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
      if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke hente prospekter"));
      setRows(d.prospects ?? []);
      toast.success(
        ui(d.added
          ? `${d.added} nye prospekter er hentet`
          : "Dagens liste er klar"),
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
    if (!r.ok) toast.error(ui("Kunne ikke oppdatere prospektet"));
  }
  return (
    <section className="surface prospects">
      <div className="operations-head">
        <div>
          <p className="eyebrow"><UiText text="INTERNT SALG" /></p>
          <h3><UiText text="Dagens prospekter" /></h3>
          <p><UiText text="Aktive norske AS med 1–30 ansatte, hentet fra Brønnøysundregistrene." /></p>
        </div>
        <Button onClick={generate} disabled={busy}>
          <RefreshCw />
          {busy
            ? ui("Henter …")
            : rows.length
              ? ui("Oppdater dagens 50")
              : ui("Hent dagens 50")}
        </Button>
      </div>
      <div className="contact-requirements internal-filters">
        <label>
          <input
            type="checkbox"
            checked={requirePhone}
            onChange={(e) => setRequirePhone(e.target.checked)}
          /><UiText text="Må ha telefonnummer" /></label>
        <label>
          <input
            type="checkbox"
            checked={requireEmail}
            onChange={(e) => setRequireEmail(e.target.checked)}
          /><UiText text="Må ha e-postadresse" /></label>
      </div>
      {loading ? (
        <p className="empty-line"><UiText text="Henter prospektlisten …" /></p>
      ) : rows.length ? (
        <ProspectRows rows={rows} update={update} />
      ) : (
        <div className="empty-state">
          <Building2 />
          <h3><UiText text="Ingen prospekter hentet" /></h3>
          <p><UiText text="Trykk «Hent dagens 50» for å lage den første listen." /></p>
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
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

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
    <div className="marketing-image-loading" aria-label={ui("Laster bilde")} />
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
 const {date,followUpLabel,daysSince,number}=useCrmFormatting();
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [unitPrice,setUnitPrice] = useState(agreedPrice);
  const [purchaseBusy,setPurchaseBusy] = useState(false);
  useEffect(()=>setUnitPrice(agreedPrice),[agreedPrice]);
  const [purchaseOpen, setPurchaseOpen] = useState(false),
    [licensed, setLicensed] = useState<number[]>([]),
    [posts, setPosts] = useState<
      {
        id: number;
        kind?: string; subject?:string; sender?:string; recipientCount?:number; sentAt?:string; error?:string; canManage?:boolean; files?:{filename:string}[];
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
  const [emailOpen,setEmailOpen]=useState(false);
  const [planOpen,setPlanOpen] = useState(false);
  useEffect(()=>{if(!planOpen)return;const timer=setInterval(()=>setPlanRevision(n=>n+1),30000);return()=>clearInterval(timer);},[planOpen]);
  const [planView,setPlanView] = useState<"upcoming"|"history">("upcoming");
  const [planQuery,setPlanQuery] = useState("");
  const [planPage,setPlanPage] = useState(1);
  const [planRevision,setPlanRevision] = useState(0);
  const [planLoading,setPlanLoading] = useState(true), [planError,setPlanError] = useState("");
  const [planMeta,setPlanMeta] = useState({page:1,pages:1,total:0});
  const [planCounts,setPlanCounts] = useState({upcoming:0,history:0});
  const [detailId,setDetailId] = useState<number|null>(null);
  const detailPost = posts.find(post=>post.id===detailId);
  function changePlanView(view:"upcoming"|"history") {if(view===planView)return;setPlanView(view);setPlanPage(1);setPlanLoading(true);}
  function showPlan() {setPlanView("upcoming");setPlanQuery("");setPlanPage(1);setPlanRevision(n=>n+1);setPlanLoading(true);setPlanOpen(true);}
  const [social,setSocial] = useState<SocialState>({ready:false,connections:[]});
  const [publishId,setPublishId] = useState<number|null>(null);
  const [publishMode,setPublishMode]=useState<'publish'|'schedule'>('publish'),[publishAt,setPublishAt]=useState('');
  const [cancellingId,setCancellingId]=useState<number|null>(null);
  const [publishing,setPublishing] = useState(false);
  const [deleteId,setDeleteId]=useState<number|null>(null),[deleting,setDeleting]=useState(false);
  const [preparing,setPreparing]=useState(false),[prepareError,setPrepareError]=useState("");
  const [preparedImages,setPreparedImages]=useState<{id:number;blob:Blob;upscaled:boolean}[]>([]);
  const [confirmedTargets,setConfirmedTargets]=useState<{id:number;accountId:string;platform:string;accountName:string}[]>([]);
  const preparedPreviews=useMemo(()=>preparedImages.map(i=>({...i,url:URL.createObjectURL(i.blob)})),[preparedImages]);
  useEffect(()=>()=>preparedPreviews.forEach(i=>URL.revokeObjectURL(i.url)),[preparedPreviews]);
  function openPublish(post:typeof posts[number],mode:'publish'|'schedule'='publish'){
    setPublishMode(mode);setPublishAt(post.scheduledAt&&Date.parse(post.scheduledAt)>Date.now()?post.scheduledAt:'');
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
          if(!response.ok)throw Error(ui("Kunne ikke hente «{0}». Prøv igjen.",{"0":image.filename}));
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
      const r=await apiFetch(deleteId<0?'/api/content-plan':'/api/marketing',{method:'DELETE',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({id:deleteId,confirm:true})});
      const d=await r.json();if(!r.ok)throw Error(d.error??'Kunne ikke fjerne innlegget.');
      setPosts(rows=>rows.filter(p=>p.id!==deleteId));setDetailId(null);setPlanLoading(true);setPlanRevision(n=>n+1);setDeleteId(null);toast.success(ui(deleteId<0?'E-posten er avbrutt eller fjernet fra historikken.':'Innlegget er fjernet fra innholdsplanen.'));
    }catch(error){toast.error(ui(error instanceof Error?error.message:'Kunne ikke fjerne innlegget.'));}
    finally{setDeleting(false);}
  }
  const publishPost = posts.find(post=>post.id===publishId);
  function canPublish(post: typeof posts[number]) {
    const selected=JSON.parse(post.platforms) as string[];
    return post.kind!=="email" && social.ready && post.status === "Kladd" && selected.length>0 && selected.every(channel=>
      ["Facebook","Instagram","LinkedIn"].includes(channel) && social.connections.some(c=>c.platform===channel&&!c.expired));
  }
  async function cancelScheduledPost(post:typeof posts[number]){
    if(cancellingId!==null)return;setCancellingId(post.id);
    try{
      const r=await apiFetch('/api/social/publish',{method:'POST',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({postId:post.id,action:'cancel',confirm:true})});
      const d=await r.json();if(!r.ok)throw Error(d.error??'Kunne ikke avbryte.');
      setPosts(rows=>rows.map(p=>p.id===post.id?{...p,status:'Kladd',error:''}:p));toast.success(ui('Publiseringen er avbrutt. Innlegget er beholdt som kladd.'));
    }catch(error){toast.error(ui(error instanceof Error?error.message:'Kunne ikke avbryte.'));}
    finally{setCancellingId(null);setPlanRevision(n=>n+1);}
  }
  async function publishNow() {
    if(!publishPost||publishing||preparing||prepareError)return;
    if(publishMode==='schedule'&&(!publishAt||!Number.isFinite(Date.parse(publishAt))||Date.parse(publishAt)<Date.now()+60000))return toast.error(ui('Velg et tidspunkt minst ett minutt frem.'));
    setPublishing(true);
    try {
      const form=new FormData();form.append('payload',JSON.stringify({postId:publishPost.id,confirm:true,targets:confirmedTargets,action:publishMode,scheduledAt:publishMode==='schedule'?new Date(publishAt).toISOString():undefined}));
      preparedImages.forEach(i=>form.append(`image:${i.id}`,i.blob,`image-${i.id}.jpg`));
      const response=await apiFetch("/api/social/publish",{method:"POST",headers:{"x-organization-id":String(organizationId)},body:form});
      const result=await response.json();
      if(!response.ok)throw Error(result.error??"Kunne ikke publisere.");
      setPosts(rows=>rows.map(p=>p.id===publishPost.id?{...p,status:result.status,scheduledAt:result.scheduledAt??p.scheduledAt,deliveries:result.results}:p));
      setPublishId(null);
      if(result.status==='Planlagt')toast.success(ui('Innlegget er planlagt og publiseres automatisk.'));
      else if(result.status==="Publisert")toast.success(ui("Innlegget er publisert."));
      else toast.error(ui("Kontroller resultatet for hver kanal i innholdsplanen."));
    } catch(error) {
      toast.error(ui(error instanceof Error?error.message:"Svaret mangler. Kontroller status før du forsøker igjen."));
      const r=await apiFetch("/api/marketing",{headers:{"x-organization-id":String(organizationId)}}).catch(()=>null);
      if(r?.ok){const d=await r.json();setPosts(d.posts??[]);}
      setPublishId(null);
    } finally {setPublishing(false);setDetailId(null);setPlanLoading(true);setPlanRevision(n=>n+1);}
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
  useEffect(()=>{setPlatforms(current=>current.filter(channel=>social.connections.some(c=>c.platform===channel&&!c.expired)));},[social]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setPlanLoading(true);setPlanError("");
    const timer = window.setTimeout(async()=>{
      try {
        const params = new URLSearchParams({view:planView,q:planQuery,page:String(planPage)});
        const r = await apiFetch(`/api/content-plan?${params}`, {headers:{"x-organization-id":String(organizationId)},signal:controller.signal});
        const d = await r.json();if(!r.ok)throw Error(d.error ?? "Kunne ikke hente innholdsplanen.");
        if(controller.signal.aborted)return;
        setPosts(d.posts ?? []);setPlanMeta(d.pagination);setPlanCounts(d.counts);
      } catch(error) {if(!controller.signal.aborted)setPlanError(error instanceof Error?error.message:"Kunne ikke hente innholdsplanen.");}
      finally {if(!controller.signal.aborted)setPlanLoading(false);}
    }, planQuery ? 250 : 0);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  }, [active, organizationId,planView,planQuery,planPage,planRevision]);
  useEffect(() => {
    if (!purchaseOpen || !canManageModules(role)) return;
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
    if (purchaseBusy || !canManageModules(role)) return;
    if (unitPrice == null) return toast.error(ui("Pris er ikke avtalt. Kontakt Noracre."));
    if (!licensed.length) return toast.error(ui("Velg minst én bruker"));
    setPurchaseBusy(true);
    try {
      const r = await apiFetch("/api/admin", {method:"POST",headers:{"content-type":"application/json","x-organization-id":String(organizationId)},body:JSON.stringify({type:"moduleStatus",moduleKey:"markedsforing",membershipIds:licensed,acceptedPrice:unitPrice})});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Kunne ikke aktivere modulen");
      onActivated(Boolean(d.currentUserActive));
      setPurchaseOpen(false);
      toast.success(ui("Modullisensene er oppdatert"));
    } catch (error) { toast.error(ui(error instanceof Error ? error.message : "Kunne ikke aktivere modulen")); }
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
      if (!r.ok) return toast.error(ui(d.error ?? "Kunne ikke lagre innlegget"));
      setPlanRevision(n=>n+1);
      setContent("");
      setScheduledAt("");
      setImages([]);
      toast.success(
        ui("Kladden er lagret"),
      );
    } catch {
      toast.error(ui("Kunne ikke lagre innlegget. Prøv igjen."));
    } finally {
      setSavingPost(false);
    }
  }
  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (images.length + selected.length > 6)
      return toast.error(ui("Du kan legge til opptil seks bilder per innlegg"));
    if (selected.some((file) => !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)))
      return toast.error(ui("Bruk PNG, JPEG, GIF eller WebP."));
    if (selected.some((file) => file.size > 10 * 1024 * 1024))
      return toast.error(ui("Hvert bilde kan være maks 10 MB"));
    if ([...images, ...selected].reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024)
      return toast.error(ui("Bildene kan være maks 20 MB samlet."));
    setImages((current) => [...current, ...selected]);
  }
  const chooser = (
    <Dialog open={purchaseOpen && canManageModules(role)} onOpenChange={setPurchaseOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle><UiText text="Markedsføring for ansatte" /></DialogTitle>
          <DialogDescription><UiText text="Avtalt pris: " />{unitPrice}<UiText text=" kr per valgt bruker per måned eks. mva." /></DialogDescription>
        </DialogHeader>
        <div className="module-member-list">
          <div className="module-member-all">
            <strong><UiText text="Aktive brukere" /></strong>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const all = members.filter((m) => m.active).map((m) => m.id);
                setLicensed(licensed.length === all.length ? [] : all);
              }}
            ><UiText text="Alle" /></Button>
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
          <span>{licensed.length}<UiText text=" brukere" /></span>
          <strong>{unitPrice == null ? ui("Pris ikke avtalt") : `${licensed.length * unitPrice} kr/mnd.`}</strong>
        </div>
        <Button disabled={purchaseBusy || unitPrice == null || !licensed.length} onClick={activate}><UiText text="Lagre og bekreft pris" /></Button>
      </DialogContent>
    </Dialog>
  );
  if (!active)
    return (
      <div className="page-pad">
        <ModuleShowcase moduleKey="markedsforing" role={role} price={unitPrice} onPurchase={() => setPurchaseOpen(true)} />
        {chooser}
      </div>
    );
  return (
    <div className="page-pad marketing-page">
      <div className="operations-head">
        <div>
          <p className="eyebrow"><UiText text="MARKEDSFØRING" /></p>
          <h2><UiText text="Innhold og utsendinger" /></h2>
        </div>
        {canManageModules(role) && (
          <Button variant="outline" onClick={() => setPurchaseOpen(true)}>
            <UsersRound /><UiText text="Administrer brukere" /></Button>
        )}
      </div>
      <div className="marketing-top-grid">
        <SocialConnections key={organizationId} organizationId={organizationId} role={role} onChange={setSocial}/>
        <section className="surface marketing-email-card"><span className="marketing-email-icon"><Mail size={28}/></span><h3><UiText text="Send e-post til kunder" /></h3><p><UiText text="Velg kundegruppe og send fra din egen e-postkonto, nå eller senere." /></p><Button onClick={()=>setEmailOpen(true)}><Mail size={18}/><UiText text="Lag e-post" /></Button><small><UiText text="Sendte og planlagte e-poster vises i innholdsplanen." /></small></section>
      </div>
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}><DialogContent className="marketing-email-dialog"><DialogHeader><DialogTitle><UiText text="E-post til kunder" /></DialogTitle><DialogDescription><UiText text="Skriv en melding og velg når den skal sendes." /></DialogDescription></DialogHeader><BulkEmail companies={companies} organizationId={organizationId} onSent={()=>{setEmailOpen(false);setPlanRevision(n=>n+1);}}/></DialogContent></Dialog>
      <section className="surface marketing-composer">
        <div className="surface-head">
          <h3><UiText text="Lag ett innlegg" /></h3>
        </div>
        <Textarea
          rows={7}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={ui("Skriv innholdet én gang …")}
        />
        <div className="marketing-images">
          <label className="marketing-image-upload">
            <Upload size={18} /><UiText text="Legg til bilder" /><input type="file" accept="image/*" multiple onChange={addImages} />
          </label>
          {imagePreviews.length > 0 && (
            <div className="marketing-image-previews">
              {imagePreviews.map(({ file, url }, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`}>
                  <img src={url} alt={`Forhåndsvisning av ${file.name}`} />
                  <button
                    type="button"
                    aria-label={ui("Fjern {0}",{"0":file.name})}
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
          <small><UiText text="Maks seks bilder, 10 MB per bilde og 20 MB samlet. PNG, JPEG, GIF eller WebP." /></small>
        </div>
        <fieldset className="social-channel-fieldset">
          <legend><UiText text="Velg kanaler" /></legend>
          <div className="channel-picks social-channel-picks">
            {channels.map((channel) => (
              <label key={channel} className={`social-channel-choice${social.connections.some(c=>c.platform===channel&&!c.expired)?"":" is-unavailable"}`} title={social.connections.some(c=>c.platform===channel&&!c.expired)?channel:`${channel} er ikke tilkoblet`}>
                <input
                  type="checkbox"
                  className="social-channel-input"
                  disabled={!social.connections.some(c=>c.platform===channel&&!c.expired)}
                  checked={platforms.includes(channel)&&social.connections.some(c=>c.platform===channel&&!c.expired)}
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
        <Label><UiText text="Ønsket publiseringstidspunkt" /></Label>
        <DateTimePicker label={ui("Ønsket publiseringstidspunkt")} value={scheduledAt} onChange={setScheduledAt} showNow/>
        <Button onClick={savePost} disabled={savingPost}>
          {savingPost ? ui("Lagrer …") : ui("Lagre kladd")}
        </Button>
        <p className="form-hint"><UiText text="Lagre kladden, og velg «Planlegg publisering» i innholdsplanen for automatisk publisering til Facebook og Instagram. Du kan også publisere med en gang." /></p>
      </section>
      <button type="button" className="content-plan-launcher" onClick={showPlan} aria-haspopup="dialog">
        <span className="content-plan-launcher-icon"><CalendarCheck2 size={22}/></span>
        <span><strong><UiText text="Innholdsplan" /></strong><small><UiText text="Innlegg og e-poster · kommende og historikk" /></small></span>
        <span className="content-plan-launcher-count">{planCounts.upcoming}<UiText text=" kommende" /></span><ChevronRight size={20}/>
      </button>
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="content-plan-dialog">
          <DialogHeader><DialogTitle><UiText text="Innholdsplan" /></DialogTitle><DialogDescription><UiText text="Kladder og planlagt publisering. Innlegg med status «Planlagt» publiseres automatisk. Publisert innhold finner du i Historikk." /></DialogDescription></DialogHeader>
          <div className="content-plan-toolbar">
            <div className="content-plan-tabs" role="group" aria-label={ui("Vis innhold")}>
              <button type="button" aria-pressed={planView==='upcoming'} onClick={()=>changePlanView('upcoming')}><UiText text="Kommende " /><span>{planCounts.upcoming}</span></button>
              <button type="button" aria-pressed={planView==='history'} onClick={()=>changePlanView('history')}><UiText text="Historikk " /><span>{planCounts.history}</span></button>
            </div>
            <label className="content-plan-search"><Search size={18}/><Input type="search" aria-label={ui("Søk i innlegg og e-poster")} placeholder={ui("Søk i innlegg og e-poster …")} value={planQuery} onChange={e=>{setPlanQuery(e.target.value);setPlanPage(1);setPlanLoading(true);}}/></label>
          </div>
          <div className="content-plan-list" aria-busy={planLoading}>
            {planLoading ? <p className="content-plan-empty" role="status"><UiText text="Henter innhold …" /></p> : planError ? <div className="content-plan-empty" role="alert"><p>{planError}</p><Button variant="outline" onClick={()=>setPlanRevision(n=>n+1)}><UiText text="Prøv igjen" /></Button></div> : !posts.length ? <p className="content-plan-empty" role="status">{planQuery ? ui("Ingen innlegg eller e-poster inneholder «{0}». Prøv et annet søk eller bytt fane.",{"0":planQuery}) : planView==='history' ? ui("Ingen publiserte innlegg eller sendte e-poster ennå.") : ui("Ingen kommende innlegg, kladder eller e-poster.")}</p> : posts.map(post=>(
              <article className="content-plan-row" key={post.id}>
                <button type="button" className="content-plan-preview" aria-label={ui("Vis innlegg: {0}",{"0":post.content.slice(0,60)})} onClick={()=>setDetailId(post.id)}>
                  <span className="content-plan-thumbnail">{post.images?.[0] ? <MarketingPostImage id={post.images[0].id} filename={post.images[0].filename} organizationId={organizationId}/> : post.kind==="email"?<Mail size={24}/>:<Megaphone size={24}/>}</span>
                  <span className="content-plan-copy"><span className="content-plan-post-text">{post.subject?`${post.subject} · `:""}{post.content}</span><small>{JSON.parse(post.platforms).join(' · ')}{post.images?.length ? ` · ${post.images.length} bilder` : ''}</small></span>
                </button>
                <div className="content-plan-date"><strong>{ui(post.status)}</strong><small>{post.sentAt ? date(post.sentAt,true) : post.scheduledAt ? date(post.scheduledAt,true) : ui("Uten planlagt tidspunkt")}</small></div>
                <div className="content-plan-actions">{canPublish(post)&&<>{(JSON.parse(post.platforms) as string[]).every(c=>['Facebook','Instagram'].includes(c))&&<Button variant="outline" onClick={()=>openPublish(post,'schedule')}><UiText text="Planlegg publisering" /></Button>}<Button variant="outline" onClick={()=>openPublish(post)}><UiText text="Publiser nå" /></Button></>}{post.kind!=='email'&&post.status==="Planlagt"&&<Button variant="outline" disabled={cancellingId!==null} onClick={()=>cancelScheduledPost(post)}>{cancellingId===post.id?ui("Avbryter …"):ui("Avbryt planlegging")}</Button>}<Button variant="ghost" aria-label={ui("Slett innlegg: {0}",{"0":post.content.slice(0,60)})} disabled={post.status==='Publiserer'||post.status==='Sender'||post.canManage===false} onClick={()=>setDeleteId(post.id)}><Trash2 size={17}/></Button></div>
              </article>
            ))}
          </div>
          <div className="content-plan-footer"><span aria-live="polite">{planLoading?ui("Henter …"):ui("{0} {1} · Side {2} av {3}",{"0":planMeta.total,"1":planQuery?ui("treff"):ui("oppføringer"),"2":planMeta.page,"3":planMeta.pages})}</span><div><Button variant="outline" disabled={planLoading||!!planError||planMeta.page<=1} onClick={()=>{setPlanPage(planMeta.page-1);setPlanLoading(true);}}><UiText text="Forrige" /></Button><Button variant="outline" disabled={planLoading||!!planError||planMeta.page>=planMeta.pages} onClick={()=>{setPlanPage(planMeta.page+1);setPlanLoading(true);}}><UiText text="Neste" /></Button></div></div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(detailPost)} onOpenChange={open=>{if(!open)setDetailId(null);}}><DialogContent className="content-plan-detail"><DialogHeader><DialogTitle>{detailPost?.kind==="email"?detailPost.subject:<UiText text="Innlegg" />}</DialogTitle><DialogDescription>{ui(detailPost?.status)} · {detailPost ? JSON.parse(detailPost.platforms).join(', ') : ''}</DialogDescription></DialogHeader>
        {detailPost&&<>{detailPost.kind!=="email"&&detailPost.error&&<p role="alert">{detailPost.error}</p>}{detailPost.kind==="email"&&<><p><UiText text="Fra: " />{detailPost.sender} · {detailPost.recipientCount}<UiText text=" mottakere" /></p>{detailPost.files?.map((f,i)=><p key={i} className="form-hint"><UiText text="Vedlegg: " />{f.filename}</p>)}{detailPost.error&&<p role="alert">{detailPost.error}</p>}</>}<p className="content-plan-full-text">{detailPost.content}</p>{detailPost.scheduledAt&&<p className="form-hint"><UiText text="Planlagt tidspunkt: " />{date(detailPost.scheduledAt,true)}</p>}<div className="marketing-post-images">{detailPost.images?.map(image=><MarketingPostImage key={image.id} id={image.id} filename={image.filename} organizationId={organizationId}/>)}</div>{detailPost.deliveries?.map(delivery=><p className="form-hint" key={delivery.platform}>{delivery.platform}: {delivery.status==='published'?<UiText text="Publisert" />:delivery.error||ui("Publiseringsforsøk pågår. Kontroller kontoen hvis statusen ikke endres.")}</p>)}<Button variant="outline" onClick={()=>setDetailId(null)}><UiText text="Tilbake til innholdsplanen" /></Button></>}
      </DialogContent></Dialog>
      <Dialog open={Boolean(publishPost)} onOpenChange={open=>{if(!open&&!publishing)setPublishId(null);}}>
        <DialogContent><DialogHeader><DialogTitle>{publishMode==='schedule'?<UiText text="Planlegg publisering" />:ui("Publiser innlegget nå?")}</DialogTitle><DialogDescription>{publishMode==='schedule'?ui("Innlegget publiseres automatisk på kontoene nedenfor til valgt tidspunkt, også når CRM er lukket."):ui("Innlegget blir synlig på kontoene nedenfor med en gang.")}</DialogDescription></DialogHeader>
          {publishPost && <><p style={{whiteSpace:"pre-wrap",maxHeight:"35vh",overflowY:"auto"}}>{publishPost.content}</p><p>{publishPost.images?.length??0}<UiText text=" bilder" /></p>
          <ul>{(JSON.parse(publishPost.platforms) as string[]).map(channel=><li key={channel}>{channel}: {confirmedTargets.find(c=>c.platform===channel)?.accountName}</li>)}</ul></>}
          {publishMode==='schedule'&&<div><Label><UiText text="Publiseringstidspunkt" /></Label><DateTimePicker label={ui("Publiseringstidspunkt")} value={publishAt} onChange={setPublishAt}/><p className="form-hint"><UiText text="Du kan avbryte i innholdsplanen frem til publiseringen starter." /></p></div>}
          {preparing&&<p role="status"><UiText text="Klargjør bilder …" /></p>}
          {prepareError&&<p role="alert">{prepareError}</p>}
          {preparedPreviews.length>0&&<><div className="marketing-publish-previews">{preparedPreviews.map((i,index)=><img key={i.id} src={i.url} alt={`Bilde ${index+1} slik det publiseres`}/>)}</div><p className="form-hint"><UiText text="Tilpasset for Instagram med proporsjonene bevart. Eventuelle marger og gjennomsiktighet får hvit bakgrunn. Animasjoner blir stillbilder." />{preparedImages.some(i=>i.upscaled)?ui(" Små originalbilder er forstørret og kan bli mindre skarpe."):''}</p></>}
          {!preparing&&!prepareError&&!preparedPreviews.length&&publishPost?.images?.length?<div className="marketing-publish-previews">{publishPost.images.map(i=><MarketingPostImage key={i.id} id={i.id} filename={i.filename} organizationId={organizationId}/>)}</div>:null}
          <Button disabled={publishing||preparing||Boolean(prepareError)||(publishMode==='schedule'&&!publishAt)} onClick={publishNow}>{publishing?(publishMode==='schedule'?ui("Planlegger …"):ui("Publiserer …")):(publishMode==='schedule'?ui("Bekreft og planlegg"):ui("Bekreft og publiser"))}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteId!==null} onOpenChange={open=>{if(!open&&!deleting)setDeleteId(null);}}><DialogContent><DialogHeader><DialogTitle>{deleteId!==null&&deleteId<0?ui("Avbryt eller fjern e-post?"):ui("Slett fra innholdsplanen?")}</DialogTitle><DialogDescription>{deleteId!==null&&deleteId<0?ui("En planlagt e-post avbrytes og blir liggende i historikken. En tidligere utsending fjernes bare fra CRM-oversikten, ikke fra mottakerens postkasse."):ui("Innlegget fjernes fra oversikten i CRM-et. Publiserte innlegg beholdes hos kanalen.")}</DialogDescription></DialogHeader><p className="marketing-delete-excerpt">{posts.find(p=>p.id===deleteId)?.content}</p><div className="offer-actions"><Button variant="outline" disabled={deleting} onClick={()=>setDeleteId(null)}><UiText text="Avbryt" /></Button><Button variant="destructive" disabled={deleting} onClick={deletePost}>{deleting?ui("Behandler …"):deleteId!==null&&deleteId<0?<UiText text="Bekreft" />:ui("Slett fra innholdsplanen")}</Button></div></DialogContent></Dialog>
      {chooser}
    </div>
  );
}
function SuperadminSettings(p: {
  activeOrgId: number;
  refreshKey: number;
  onUserCreated: () => void;
  newOrg: NewOrganization;
  setNewOrg: (value: NewOrganization) => void;
  addOrg: () => void;
  members: Member[];
  newMember: { name: string; email: string; role: string };
  setNewMember: (value: { name: string; email: string; role: string }) => void;
  addMember: () => void;
  ownerEmail: string;
}) {
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const {t}=useI18n();
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
        return toast.error(ui(data.error ?? "Kunne ikke søke etter bedriften"));
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
        title={ui("Kundeorganisasjoner")}
        ico={<Building2 />}
      >
        <div className="organization-form">
          <div className="lookup-row">
            <Input
              placeholder={ui("Søk etter bedriftsnavn eller organisasjonsnummer")}
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
              {companySearchBusy ? ui("Søker …") : ui("Søk i Brreg")}
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
                    <small><UiText text="Org: " />{company.orgNumber} · {company.city}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
          {companySearched && !companyResults.length && (
            <p className="form-hint"><UiText text="Fant ingen treff. Du kan fylle inn bedriften manuelt nedenfor." /></p>
          )}
          <Input
            placeholder={ui("Bedriftsnavn")}
            value={p.newOrg.name}
            onChange={(e) => p.setNewOrg({ ...p.newOrg, name: e.target.value })}
          />
          <HomeCountryPicker value={p.newOrg.homeCountry} onChange={homeCountry=>p.setNewOrg({...p.newOrg,homeCountry,operatingCountries:registerCountries.some(c=>c.code===homeCountry)?[homeCountry as RegisterCountry]:[]})}/>
          <OperatingCountryPicker value={p.newOrg.operatingCountries} onChange={operatingCountries=>p.setNewOrg({...p.newOrg,operatingCountries})}/>
          <Input
            maxLength={30}
            placeholder={ui("Organisasjonsnummer")}
            value={p.newOrg.orgNumber}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, orgNumber: e.target.value })
            }
          />
          <Input
            placeholder={ui("Kontaktpersonens navn")}
            value={p.newOrg.adminName}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, adminName: e.target.value })
            }
          />
          <Input
            placeholder={ui("Kontaktpersonens e-post")}
            value={p.newOrg.adminEmail}
            onChange={(e) =>
              p.setNewOrg({ ...p.newOrg, adminEmail: e.target.value })
            }
          />
          <Input
            type="tel"
            placeholder={ui("Kontaktpersonens telefonnummer")}
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
            <SelectTrigger aria-label={ui("Kontaktpersonens rolle")}>
              <SelectValue placeholder={ui("Velg rolle")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrator">Administrator</SelectItem>
              <SelectItem value="Bruker"><UiText text="Bruker" /></SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
            </SelectContent>
          </Select>
          {p.newOrg.adminRole === "Partner" && <p className="form-hint">{t('partner.newHint')}</p>}
          {p.newOrg.adminRole === "Partner" && <CommissionField value={p.newOrg.commissionPercent} onChange={commissionPercent=>p.setNewOrg({...p.newOrg,commissionPercent})}/>}
          <PartnerPicker organizationId={p.activeOrgId} refreshKey={p.refreshKey} value={p.newOrg.referredByPartnerId} onChange={referredByPartnerId=>p.setNewOrg({...p.newOrg,referredByPartnerId})}/>
          <NegotiatedPrices values={p.newOrg} change={(values) => p.setNewOrg({...p.newOrg,...values})} />
          <Button onClick={p.addOrg}><UiText text="Opprett kundeorganisasjon" /></Button>
        </div>
      </AdminCard>
      <AdminCard
        eye="BEDRIFTSBRUKERE"
        title={ui("Opprett bruker i en bedrift")}
        ico={<Building2 />}
      >
        <CompanyUserCreate organizationId={p.activeOrgId} refreshKey={p.refreshKey} onCreated={p.onUserCreated} />
      </AdminCard>
      <AdminCard
        eye="EIERKONTROLL"
        title={ui("Superadministratorer")}
        ico={<ShieldCheck />}
      >
        <p><UiText text="Bare eierkontoen kan gi superadmintilgang." /></p>
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
                    ? ui("Eier")
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
              placeholder={ui("Navn")}
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
              placeholder={ui("E-post")}
              value={p.newMember.role === "Superadmin" ? p.newMember.email : ""}
              onChange={(e) =>
                p.setNewMember({
                  ...p.newMember,
                  email: e.target.value,
                  role: "Superadmin",
                })
              }
            />
            <Button onClick={p.addMember}><UiText text="Gi superadmintilgang" /></Button>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
function Operations(p: {
  activeOrgId:number;
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
    > & PriceFields & {referredByPartnerId:string;commissionPercent:string},
  ) => Promise<boolean>;
}) {
 const {date,followUpLabel,daysSince,number}=useCrmFormatting();
 const {ui}=useUiTranslation();
  const {t}=useI18n();
  const [q, setQ] = useState(""),
    [selectedOrganization, setSelectedOrganization] =
      useState<OperationOrganization | null>(null),
    [details, setDetails] = useState({
      commissionPercent:"",
      referredByPartnerId:"none",
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
      commissionPercent:organization.commissionBps==null?"":String(organization.commissionBps/100),
      referredByPartnerId:organization.referredByPartnerId?String(organization.referredByPartnerId):"none",
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
      return toast.error(ui("Ingen kontaktpersoner i utvalget har e-postadresse"));
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent("Informasjon fra Noracre CRM")}`;
  }
  if (!p.data)
    return (
      <div className="page-pad">
        <section className="surface">
          <p><UiText text="Laster driftsoversikten …" /></p>
        </section>
      </div>
    );
  const s = p.data.summary;
  return (
    <div className="page-pad operations">
      <div className="operations-banner">
        <div>
          <p className="eyebrow"><UiText text="KUN FOR SUPERADMIN" /></p>
          <h2><UiText text="Drift og kundeoversikt" /></h2>
          <p><UiText text="Her ser du abonnementer, bruk og supportbehov på tvers av alle kundeorganisasjoner." /></p>
        </div>
        <HealthStatus/>
      </div>
      <div className="metric-grid operations-metrics">
        <Metric
          label={ui("Aktive bedrifter")}
          value={s.activeOrganizations}
          tone="green"
        />
        <Metric label={ui("Aktive brukere")} value={s.activeUsers} />
        <Metric
          label={ui("Deaktiverte bedrifter")}
          value={s.lostOrganizations}
          tone="red"
        />
        <Metric label="Deaktiverte brukere" value={s.lostUsers} tone="red" />
        <Metric label="Ringelistemoduler" value={s.ringModuleOrganizations} />
        <Metric
          label={ui("Markedsføringsmoduler")}
          value={s.marketingModuleOrganizations}
        />
        <div className="metric money">
          <span><UiText text="Beregnet månedsbeløp" /></span>
          <strong>{number(s.monthlyAmount)} kr</strong>
        </div>
      </div>
      <OperationsInsights organizationId={p.activeOrgId}/>
      <details className="surface operations-fold customer-organizations-fold"><summary className="operations-fold-trigger"><span><strong><UiText text="Kundeorganisasjoner" /></strong></span><ChevronRight size={20}/></summary><div className="operations-fold-body">
        <div className="operations-head">
          <div className="operations-toolbar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Mail /><UiText text="Send mail" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => emailOrganizations("Aktiv")}><UiText text="Aktive bedrifter" /></DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => emailOrganizations("Deaktivert")}
                ><UiText text="Deaktiverte bedrifter" /></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="search-box operations-search">
              <Search size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ui("Søk etter kunde …")}
              />
            </div>
          </div>
        </div>
        <div className="operations-table">
          <div className="operations-table-head">
            <span><UiText text="Bedrift" /></span>
            <span><UiText text="Kontaktperson" /></span>
            <span><UiText text="Brukere" /></span>
            <span><UiText text="Moduler" /></span>
            <span><UiText text="Bruk siste 30 dager" /></span>
            <span><UiText text="Månedsbeløp" /></span>
            <span><UiText text="Status og handlinger" /></span>
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
                  {o.crmCustomers}<UiText text=" kunder i CRM · sist brukt" />{" "}
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
                  <small><UiText text="E-post mangler" /></small>
                )}
                {o.primaryContactPhone ? (
                  <PhoneLink phone={o.primaryContactPhone}/>
                ) : null}
              </div>
              <span>
                {o.activeUsers}<UiText text=" aktive" />{o.lostUsers ? ` · ${o.lostUsers} deaktiverte` : ""}
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
                  .join(" · ") || ui("Kun CRM")}
              </span>
              <span>{o.activities30d}<UiText text=" aktiviteter" /></span>
              <strong>{number(o.monthlyAmount)} kr</strong>
              <div className="operations-actions">
                <Select
                  value={o.status}
                  onValueChange={(v) => p.setStatus(o.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiv"><UiText text="Aktiv" /></SelectItem>
                    <SelectItem value="Deaktivert"><UiText text="Deaktivert" /></SelectItem>
                  </SelectContent>
                </Select>
                {o.scheduledDisableAt && <><small><UiText text="Deaktiveres " />{date(o.scheduledDisableAt,true)}</small><Button variant="outline" onClick={()=>p.setStatus(o.id,"Aktiv")}><UiText text="Avbryt deaktivering" /></Button></>}
                {o.status === "Deaktivert" && o.retainUntil && (
                  <small><UiText text="Data beholdes til " />{date(o.retainUntil)}</small>
                )}
                {o.hasSupportAccess ? (
                  <Button onClick={() => p.openOrganization(o.id)}><UiText text="Åpne CRM" /></Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={o.pendingAccessRequest}
                    onClick={() => p.requestAccess(o.id)}
                  >
                    <Headphones />
                    {o.pendingAccessRequest
                      ? ui("Forespørsel sendt")
                      : ui("Be om tilgang")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div></details>
      <Dialog
        open={Boolean(selectedOrganization)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrganization(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrganization?.name}</DialogTitle>
            <DialogDescription><UiText text="Kundeinformasjon, abonnement og bruk av Noracre CRM." /></DialogDescription>
          </DialogHeader>
          <div className="organization-detail-summary">
            <div>
              <span><UiText text="Brukere" /></span>
              <strong>{selectedOrganization?.activeUsers ?? 0}<UiText text=" aktive" /></strong>
            </div>
            <div>
              <span><UiText text="Kunder i CRM" /></span>
              <strong>{selectedOrganization?.crmCustomers ?? 0}</strong>
            </div>
            <div>
              <span><UiText text="Månedsbeløp" /></span>
              <strong>
                {number(selectedOrganization?.monthlyAmount ?? 0)}{" "}
                kr
              </strong>
            </div>
          </div>
          <div className="form-grid organization-detail-form">
            <div className="full">
              <Label><UiText text="Bedriftsnavn" /></Label>
              <Input
                value={details.name}
                onChange={(event) =>
                  setDetails({ ...details, name: event.target.value })
                }
              />
            </div>
            <div>
              <Label><UiText text="Organisasjonsnummer " /></Label>
              <Input
                inputMode="numeric"
                value={details.orgNumber}
                onChange={(event) =>
                  setDetails({ ...details, orgNumber: event.target.value })
                }
                placeholder={ui("9 sifre")}
              />
            </div>
            <div>
              <Label><UiText text="Bransje" /></Label>
              <Input
                value={details.industry}
                onChange={(event) =>
                  setDetails({ ...details, industry: event.target.value })
                }
                placeholder={ui("Ikke registrert")}
              />
            </div>
            <div className="full">
              <Label><UiText text="Adresse" /></Label>
              <Input
                value={details.address}
                onChange={(event) =>
                  setDetails({ ...details, address: event.target.value })
                }
                placeholder={ui("Ikke registrert")}
              />
            </div>
            <div>
              <Label><UiText text="Postnummer" /></Label>
              <Input
                value={details.postalCode}
                onChange={(event) =>
                  setDetails({ ...details, postalCode: event.target.value })
                }
              />
            </div>
            <div>
              <Label><UiText text="Poststed" /></Label>
              <Input
                value={details.city}
                onChange={(event) =>
                  setDetails({ ...details, city: event.target.value })
                }
              />
            </div>
            <div>
              <Label><UiText text="Telefon" /></Label>
              <Input
                type="tel"
                value={details.phone}
                onChange={(event) =>
                  setDetails({ ...details, phone: event.target.value })
                }
                placeholder={ui("Ikke registrert")}
              />
            </div>
            <div>
              <Label><UiText text="E-post" /></Label>
              <Input
                type="email"
                value={details.email}
                onChange={(event) =>
                  setDetails({ ...details, email: event.target.value })
                }
                placeholder={ui("Ikke registrert")}
              />
            </div>
          </div>
          <div className="organization-form partner-assignment">
            <Label>{t('partner.referrer')}</Label>
            <ReferrerSelect rows={(p.data?.organizations??[]).filter(o=>o.id!==selectedOrganization?.id).map(o=>({...o,scheduledDisableAt:o.scheduledDisableAt??""}))} value={details.referredByPartnerId} onChange={referredByPartnerId=>setDetails({...details,referredByPartnerId})}/>
          </div>
          {selectedOrganization?.isPartner && <CommissionField editing value={details.commissionPercent} onChange={commissionPercent=>setDetails({...details,commissionPercent})}/>}
          <NegotiatedPrices values={details} change={(values) => setDetails({...details,...values})} />
          <p className="form-hint"><UiText text="Lagre prisene dere har avtalt. Endringen gjelder eksisterende og nye brukerlisenser fra nå; tidligere fakturagrunnlag beholdes." /></p>
          <div className="offer-actions">
            <Button
              variant="outline"
              onClick={() => setSelectedOrganization(null)}
            ><UiText text="Lukk" /></Button>
            <Button
              onClick={async () => {
                if (!selectedOrganization) return;
                if (await p.updateDetails(selectedOrganization.id, details))
                  setSelectedOrganization(null);
              }}
            ><UiText text="Lagre informasjon" /></Button>
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
  open?:boolean;
  eye?: string;
  title: string;
  ico: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="surface admin-card" open={p.open}>
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
 const {ui}=useUiTranslation();
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
          <DialogTitle><UiText text="Tilpass profilbildet" /></DialogTitle>
          <DialogDescription><UiText text="Dra bildet med musen for å plassere det. Bruk skyveknappen for å zoome." /></DialogDescription>
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
                alt={ui("Forhåndsvisning av profilbilde")}
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
              aria-label={ui("Zoom profilbilde")}
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
          <Button onClick={() => setOpen(false)}><UiText text="Bruk bildet" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function NegotiatedPrices({values,change}:{values:PriceFields;change:(value:PriceFields)=>void}) {
 const {ui}=useUiTranslation();
  return <fieldset className="negotiated-prices"><legend><UiText text="Avtalte priser" /></legend>
    <p className="form-hint"><UiText text="Kroner per bruker per måned, eks. mva. Skriv 0 hvis inkludert. Tom modulpris betyr at pris må avtales før kjøp." /></p>
    {([["crmPrice",ui("CRM-bruker")],["ringPrice",ui("Ringelister")],["marketingPrice",ui("Markedsføring")]] as const).map(([key,label])=><label key={key}>{label}<Input type="number" min="0" max="1000000" step="1" inputMode="numeric" required={key==="crmPrice"} value={values[key]} onChange={e=>change({...values,[key]:e.target.value})} placeholder={key==="crmPrice"?ui("Avtalt pris"):ui("Ikke avtalt")}/></label>)}
  </fieldset>;
}
