export function normalize(raw: string): string {
  let s = (raw || "").toUpperCase();

  s = s.replace(/SOLICITED ORDER DISCRETION EXERCISED/g, " ");
  s = s.replace(/AVERAGE UNIT PRICE TRANSACTION/g, " ");
  s = s.replace(/YOUR BROKER ACTED AS AGENT/g, " ");
  s = s.replace(/\bUNSOLICITED\b/g, " ");

  s = s.replace(/\b\d{6,}[\d-]*\b/g, " ");

  s = s.replace(/\bPROCTOR\b/g, "PROCTER");
  s = s.replace(/\bWATCH GROUP\b/g, "MATCH GROUP");
  s = s.replace(/\bNFL BUSINESS MACH\b/g, "INTL BUSINESS MACH");
  s = s.replace(/\bMOSLIS\b/g, "MOELIS");
  s = s.replace(/\bMOBLIS\b/g, "MOELIS");
  s = s.replace(/\bCOM\s+INC\b/g, "INC");

  for (let i = 0; i < 5; i++) {
    s = s.replace(
      /[\s,.]+(COM|CL\s+[ABC]|CLASS\s+[ABC]|SHS|REIT|NEW|INC NEW)$/,
      ""
    );
  }

  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[,.\s]+$/, "").trim();
  return s;
}
