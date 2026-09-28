import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppLanguage } from '../types';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<AppLanguage, Record<string, string>> = {
  en: {
    // Brand & Roles
    app_subtitle: 'Receivables SaaS for Indian MSMEs',
    role_owner: 'Business Owner (Sethji)',
    role_accountant: 'Senior Accountant (Munimji)',
    role_clerk: 'Junior Collection Executive',
    role_admin: 'Admin & Compliance',

    // Terminology Guide (userexperiance.md Section 1.5)
    term_sync: 'Refresh from Tally',
    term_dso: 'Average Payment Cycle',
    term_aging: 'Bill Age (Recent to Old)',
    term_ptp: 'Payment Commitment / Date',
    term_reconciliation: 'Bill Matching (Hisab-Kitab)',
    term_exact_match: 'Exact Match (100%)',
    term_write_back: 'Save Receipt in Tally',
    term_tenant: 'Company / Firm',
    term_credit_note: 'Return & Discount Adjustment',
    term_section_43bh: '45-Day MSME Payment Rule (Section 43B(h))',

    // 10-Minute Daily Morning Routine
    routine_title: '10-Minute Daily Collection Routine',
    routine_subtitle: 'Guided 4-step morning workflow for fast, zero-effort collections',
    routine_step1: 'Step 1: Morning Financial Pulse',
    routine_step1_desc: 'Review today due inflow, broken commitments, and new bank credits',
    routine_step2: 'Step 2: Review & Send WhatsApp Reminders',
    routine_step2_desc: '1-Click batch reminder dispatch with polite templates & safety preview',
    routine_step3: 'Step 3: 1-Click Payment Approval & Tally Sync',
    routine_step3_desc: 'Match bank money to open bills and post receipt vouchers to Tally',
    routine_step4: 'Step 4: Broken Promise Follow-up',
    routine_step4_desc: 'Quick call or polite notice to customers whose promised date elapsed',

    // Morning Pulse Cards
    pulse_urgent_broken: 'Missed Payment Commitments',
    pulse_urgent_broken_desc: 'customers missed their promised payment date yesterday',
    pulse_today_due: "Today's Inflow Target",
    pulse_today_due_desc: 'due today waiting for customer clearance',
    pulse_unmatched_payments: 'New Bank Money Received',
    pulse_unmatched_payments_desc: 'received via UPI/Bank waiting to be matched to Tally',

    // Actions
    btn_review_promises: 'Review Broken Promises',
    btn_view_due: "View Today's Due",
    btn_match_payments: 'Match Payments',
    btn_send_reminders: 'Send Daily Reminders',
    btn_confirm_dispatch: 'Confirm & Dispatch Messages',
    btn_confirm_tally_voucher: 'Confirm & Create Tally Voucher',
    btn_call_contact: 'Call Contact Person',
    btn_send_whatsapp_notice: 'Send Polite WhatsApp Notice',
    btn_extend_promise: 'Extend Commitment Date',
    btn_settle_tds: 'Settle with TDS Certificate Pending',
    btn_raise_dispute: 'Flag Bill Disputed',

    // Navigation
    nav_dashboard: 'Dashboard',
    nav_invoices: 'Outstanding Bills',
    nav_customers: 'Customers 360',
    nav_payments: 'Payments & UPI',
    nav_reconciliation: 'Match Payments',
    nav_reminders: 'WhatsApp Follow-ups',
    nav_analytics: 'Collection Intelligence',
    nav_copilot: 'AI Copilot',
    nav_promotions: 'Promotions & Schemes',
    nav_integrations: 'Integrations & Import',
    nav_partner: 'CA / Partner Portal',
    nav_billing: 'Billing & Plans',
    nav_settings: 'Settings & Tally Sync',
    nav_team: 'Team & Roles',
    nav_diagnostics: 'Admin & Diagnostics',
    nav_observability: 'Operations & Health',
    nav_security: 'Security & Compliance',
    nav_pilot: 'Pilot Operations Hub',
  },
  hi: {
    // Brand & Roles
    app_subtitle: 'भारतीय एमएसएमई के लिए उधारी वसूली सॉफ्टवेयर',
    role_owner: 'व्यापार मालिक (सेठजी)',
    role_accountant: 'वरिष्ठ मुनीम (मुनीमजी)',
    role_clerk: 'कलेक्शन कर्मचारी',
    role_admin: 'एडमिन एवं अनुपालन',

    // Terminology Guide (userexperiance.md Section 1.5)
    term_sync: 'टैली से डेटा अपडेट करें',
    term_dso: 'पैसा आने का औसत समय',
    term_aging: 'बिल की उम्र (उधारी)',
    term_ptp: 'भुगतान का वादा (तारीख)',
    term_reconciliation: 'खाता मिलाना / हिसाब-किताब',
    term_exact_match: 'पूरा मैच (100% सही)',
    term_write_back: 'टैली में रसीद दर्ज करें',
    term_tenant: 'कंपनी / फर्म / दुकान',
    term_credit_note: 'माल वापसी / छूट समायोजन',
    term_section_43bh: 'एमएसएमई कानून (45 दिन नियम)',

    // 10-Minute Daily Morning Routine
    routine_title: '10 मिनट की दैनिक सुबह की दिनचर्या',
    routine_subtitle: 'बिना किसी परेशानी के त्वरित वसूली के लिए 4-चरणीय मार्गदर्शिका',
    routine_step1: 'चरण 1: सुबह का वित्तीय जायजा',
    routine_step1_desc: 'आज आने वाला पैसा, टूटे वादे और बैंक में आई रकम देखें',
    routine_step2: 'चरण 2: व्हाट्सएप याददाश्त संदेश भेजें',
    routine_step2_desc: 'सभ्य भाषा में 1-क्लिक से ग्राहकों को संदेश भेजें',
    routine_step3: 'चरण 3: प्राप्त भुगतान मिलाएं और टैली में डालें',
    routine_step3_desc: 'बैंक के पैसे को बिल से मिलाकर टैली में रसीद बनाएं',
    routine_step4: 'चरण 4: टूटे वादों पर तुरंत संपर्क',
    routine_step4_desc: 'जिन ग्राहकों की तारीख निकल गई उन्हें कॉल या संदेश भेजें',

    // Morning Pulse Cards
    pulse_urgent_broken: 'तारीख पर नहीं आया भुगतान',
    pulse_urgent_broken_desc: 'ग्राहकों का भुगतान वादे की तारीख पर नहीं आया',
    pulse_today_due: 'आज आने वाली कुल उधारी',
    pulse_today_due_desc: 'आज देय बिल जो ग्राहकों से प्राप्त होने हैं',
    pulse_unmatched_payments: 'बैंक में नया पैसा प्राप्त हुआ',
    pulse_unmatched_payments_desc: 'यूपीआई/बैंक में प्राप्त रकम जिसे टैली से मिलाना है',

    // Actions
    btn_review_promises: 'टूटे वादों की सूची देखें',
    btn_view_due: 'आज के देय बिल देखें',
    btn_match_payments: 'खाता मिलाएं',
    btn_send_reminders: 'आज के संदेश भेजें',
    btn_confirm_dispatch: 'पुष्टि करें और संदेश भेजें',
    btn_confirm_tally_voucher: 'पुष्टि करें और टैली वाउचर बनाएं',
    btn_call_contact: 'ग्राहक को कॉल करें',
    btn_send_whatsapp_notice: 'व्हाट्सएप संदेश भेजें',
    btn_extend_promise: 'नई तारीख दर्ज करें',
    btn_settle_tds: 'टीडीएस काटकर बिल चुकता करें',
    btn_raise_dispute: 'विवादित बिल दर्ज करें',

    // Navigation
    nav_dashboard: 'डैशबोर्ड (दिनचर्या)',
    nav_invoices: 'उधारी बिल',
    nav_customers: 'ग्राहक 360',
    nav_payments: 'भुगतान और यूपीआई',
    nav_reconciliation: 'हिसाब मिलान',
    nav_reminders: 'व्हाट्सएप तगादा',
    nav_analytics: 'वसूली विश्लेषण',
    nav_copilot: 'एआई सहायक',
    nav_promotions: 'प्रमोशन एवं स्कीम्स',
    nav_integrations: 'टैली/एक्सेल जोड़ें',
    nav_partner: 'सीए / पार्टनर पोर्टल',
    nav_billing: 'बिलिंग एवं प्लान',
    nav_settings: 'सेटिंग्स और टैली सिंक',
    nav_team: 'टीम और सदस्य',
    nav_diagnostics: 'एडमिन एवं तकनीकी टूल्स',
    nav_observability: 'सिस्टम निगरानी',
    nav_security: 'सुरक्षा एवं गोपनीयता',
    nav_pilot: 'पायलट ऑपरेशन्स',
  },
  gu: {
    // Brand & Roles
    app_subtitle: 'ભારતીય MSME માટે ઉઘરાણી ઓટોમેશન સોફ્ટવેર',
    role_owner: 'વેપાર માલિક (શેઠજી)',
    role_accountant: 'મુખ્ય મુનીમજી',
    role_clerk: 'ઉઘરાણી સ્ટાફ',
    role_admin: 'એડમિન અને પાલન',

    // Terminology Guide (userexperiance.md Section 1.5)
    term_sync: 'ટેલીમાંથી ડેટા અપડેટ કરો',
    term_dso: 'નાણાં આવવાનો સરેરાશ સમય',
    term_aging: 'બિલની ઉંમર (ઉધારી)',
    term_ptp: 'ચુકવણીનું વચન (તારીખ)',
    term_reconciliation: 'ખાતા મેળવણી / હિસાબ',
    term_exact_match: 'સંપૂર્ણ મેળ (100% સાચું)',
    term_write_back: 'ટેલીમાં પાવતી બનાવો',
    term_tenant: 'વેપાર / પેઢી / દુકાન',
    term_credit_note: 'માલ વાપસી / વળતર',
    term_section_43bh: 'MSME કાયદો (45 દિવસ નિયમ)',

    // 10-Minute Daily Morning Routine
    routine_title: '10 મિનિટની દૈનિક સવારની દિનચર્યા',
    routine_subtitle: 'સરળતાથી ઝડપી ઉઘરાણી માટે 4-તબક્કાનું માર્ગદર્શન',
    routine_step1: 'તબક્કો 1: સવારનું નાણાકીય નિરીક્ષણ',
    routine_step1_desc: 'આજે આવતી રકમ, ચૂકેલા વચનો અને બેંકમાં જમા થયેલ રકમ તપાસો',
    routine_step2: 'તબક્કો 2: વોટ્સએપ યાદી મોકલો',
    routine_step2_desc: '1-ક્લિકમાં નમ્ર ભાષામાં ગ્રાહકોને યાદ અપાવતા સંદેશાઓ મોકલો',
    routine_step3: 'તબક્કો 3: મળેલા નાણાં મેળવો અને ટેલીમાં નાખો',
    routine_step3_desc: 'બેંક રકમને બાકી બિલ સાથે મેળવી ટેલીમાં રિસિપ્ટ વાઉચર બનાવો',
    routine_step4: 'તબક્કો 4: ચૂકેલા વચનોનું ફોલો-અપ',
    routine_step4_desc: 'જે ગ્રાહકોની તારીખ વીતી ગઈ છે તેમને કોલ અથવા મેસેજ કરો',

    // Morning Pulse Cards
    pulse_urgent_broken: 'તારીખે નાણાં ન ચૂકવ્યા હોય તેવા',
    pulse_urgent_broken_desc: 'ગ્રાહકોએ આપેલા વચન મુજબ ગઈકાલે નાણાં ચૂકવ્યા નથી',
    pulse_today_due: 'આજની કુલ ઉઘરાણી',
    pulse_today_due_desc: 'આજે પાકતી મુદતના બિલો જે ગ્રાહકો પાસેથી લેવાના છે',
    pulse_unmatched_payments: 'બેંકમાં નવા નાણાં મળ્યા',
    pulse_unmatched_payments_desc: 'UPI/બેંકમાં જમા થયેલ રકમ જે ટેલી સાથે મેળવવાની બાકી છે',

    // Actions
    btn_review_promises: 'ચૂકેલા વચનો જુઓ',
    btn_view_due: 'આજના બાકી બિલો જુઓ',
    btn_match_payments: 'હિસાબ મેળવો',
    btn_send_reminders: 'આજના સંદેશાઓ મોકલો',
    btn_confirm_dispatch: 'ખાતરી કરી સંદેશા મોકલો',
    btn_confirm_tally_voucher: 'ખાતરી કરી ટેલી વાઉચર બનાવો',
    btn_call_contact: 'ગ્રાહકને ફોન કરો',
    btn_send_whatsapp_notice: 'વોટ્સએપ સંદેશ મોકલો',
    btn_extend_promise: 'નવી તારીખ નોંધો',
    btn_settle_tds: 'TDS કાપીને બિલ પૂરું કરો',
    btn_raise_dispute: 'વિવાદિત બિલ નોંધો',

    // Navigation
    nav_dashboard: 'ડેશબોર્ડ (દિનચર્યા)',
    nav_invoices: 'બાકી બિલો',
    nav_customers: 'ગ્રાહક 360',
    nav_payments: 'ચુકવણી અને UPI',
    nav_reconciliation: 'હિસાબ મેળવણી',
    nav_reminders: 'વોટ્સએપ તગાદો',
    nav_analytics: 'ઉઘરાણી વિશ્લેષણ',
    nav_copilot: 'AI સહાયક',
    nav_promotions: 'પ્રમોશન અને સ્કીમ્સ',
    nav_integrations: 'ટેલી/એક્સેલ જોડો',
    nav_partner: 'CA / પાર્ટનર પોર્ટલ',
    nav_billing: 'બિલિંગ અને પ્લાન',
    nav_settings: 'સેટિંગ્સ અને ટેલી સિંક',
    nav_team: 'ટીમ અને સભ્યો',
    nav_diagnostics: 'એડમિન અને તકનીકી ટૂલ્સ',
    nav_observability: 'સિસ્ટમ સ્થિતિ',
    nav_security: 'સુરક્ષા અને કાયદો',
    nav_pilot: 'પાયલોટ હબ',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('collectflow_lang');
    return (saved as AppLanguage) || 'en';
  });

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('collectflow_lang', lang);
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations.en;
    if (langDict[key]) return langDict[key];
    if (translations.en[key]) return translations.en[key];
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: string) => translations['en']?.[key] || key,
    };
  }
  return context;
};
