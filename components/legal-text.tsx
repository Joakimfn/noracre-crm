"use client";
import {useI18n} from '@/lib/i18n/react';
import {translateLegal} from '@/lib/legal-i18n';
/** Presentation translation of developer-authored legal and informational copy. */
export function LegalText({text}:{text:string}){const {locale}=useI18n();return <>{translateLegal(text,locale)}</>;}
