"use client";
import {useUiTranslation} from '@/lib/i18n/ui';

import { useMemo, useState } from 'react';
import Home from '@/app/crm-client';
import { CrmApiProvider } from '@/lib/crm-api';
import { createDemoRuntime } from '@/lib/demo-crm';
/** Separate request handler and state per mount. No production requests or shared storage. */
export function PartnerPreview({ onClose }: {
    onClose: () => void;
}) {
 const {ui}=useUiTranslation();
    const [version, setVersion] = useState(0);
    const demo = useMemo(() => createDemoRuntime(), [version]);
    return <CrmApiProvider request={demo.request}><Home key={version} demoMode onDemoClose={onClose} onDemoReset={() => { if (window.confirm(ui('Nullstille demoen og hente frem eksempeldataene igjen?')))
        setVersion(n => n + 1); }}/></CrmApiProvider>;
}

