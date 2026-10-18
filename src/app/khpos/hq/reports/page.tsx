import type {Metadata} from "next";
import {CorporateReportingCentre} from "@/components/khpos/CorporateReportingCentre";
export const metadata:Metadata={title:"Corporate Reporting | KAEC HQ",robots:{index:false,follow:false}};
export default function HqReportsPage(){return <CorporateReportingCentre/>;}
