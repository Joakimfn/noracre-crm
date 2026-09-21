"use client";
import { createContext, useContext, type ReactNode } from 'react';
import { apiFetch } from './api-client';
export type CrmRequest = typeof apiFetch;
const CrmApiContext = createContext<{
    request: CrmRequest;
    demo: boolean;
}>({ request: apiFetch, demo: false });
export function CrmApiProvider({ request, children }: {
    request: CrmRequest;
    children: ReactNode;
}) { return <CrmApiContext.Provider value={{ request, demo: true }}>{children}</CrmApiContext.Provider>; }
export const useCrmApi = () => useContext(CrmApiContext).request;
export const useDemoMode = () => useContext(CrmApiContext).demo;
