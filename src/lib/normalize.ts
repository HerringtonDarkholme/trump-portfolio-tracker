export function normalize(raw: string): string {
  let s = (raw || "").toUpperCase();

  s = s.replace(/SOLICITED ORDER DISCRETION EXERCISED/g, " ");
  s = s.replace(/AVERAGE UNIT PRICE TRANSACTION/g, " ");
  s = s.replace(/YOUR BROKER ACTED AS AGENT/g, " ");
  s = s.replace(/ALLOCATED ORDER/g, " ");
  s = s.replace(/FORWARD SPLIT WITH STOCK SPLIT SHARES/g, " ");
  s = s.replace(/MERGER ELECTION EXP:\s*\d{2}\/\d{2}\/\d{2}/g, " ");
  s = s.replace(/\bWITH DUE BILLS\b/g, " ");
  s = s.replace(/\bPAIRED CTF[^,]*$/g, " ");
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\bEQUITY CLASS\s*$/g, " ");
  s = s.replace(/\bUNSOLICITED\b/g, " ");
  s = s.replace(/\bUSD\d*\.\d+\b/g, " ");
  s = s.replace(/\bUSD\b/g, " ");
  s = s.replace(/\bYOUR BROKER\s*$/g, " ");

  s = s.replace(/\b[A-Z]?\d{6,}[\d-]*\b/g, " ");

  s = s.replace(/\bPROCTOR\b/g, "PROCTER");
  s = s.replace(/\bWATCH GROUP\b/g, "MATCH GROUP");
  s = s.replace(/\bNFL BUSINESS MACH\b/g, "INTL BUSINESS MACH");
  s = s.replace(/\bMOSLIS\b/g, "MOELIS");
  s = s.replace(/\bMOBLIS\b/g, "MOELIS");
  s = s.replace(/\bCOM\s+INC\b/g, "INC");

  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[,.\s]+$/, "").trim();

  for (let i = 0; i < 7; i++) {
    s = s.replace(
      /[\s,.]+(COM|CL\s+[ABC]|CLASS\s+[ABC]|SHS|REIT|NEW|INC NEW|DEL|F|CAP STK|EQUITY|EUR|ORD|ORD SHS|N V|NV|HLDGS|HOLDINGS)$/,
      ""
    );
  }

  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[,.\s]+$/, "").trim();
  return s;
}
