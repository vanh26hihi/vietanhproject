export type ProfileId = "cherry" | "oem" | "xda" | "dsa" | "sa";
export type SizeId = "1u" | "1.25u" | "1.5u" | "1.75u" | "2u" | "2.25u" | "2.75u" | "6.25u" | "custom";

export interface KeycapParams {
  sizeId: SizeId;
  profileId: ProfileId;
  units: number;
  pitch: number;
  bottomWidth: number;
  bottomDepth: number;
  topWidth: number;
  topDepth: number;
  height: number;
  wallThickness: number;
  topThickness: number;
  sideDraft: number;
  cornerRadius: number;
  topCornerRadius: number;
  dishDepth: number;
  dishStrength: number;
  topTilt: number;
  filletTop: number;
  stemEnabled: boolean;
  stemDiameter: number;
  stemHeight: number;
  crossLength: number;
  crossWidth: number;
  stemClearance: number;
  stabEnabled: boolean;
  stabSpacing: number;
  xyCompensation: number;
  zCompensation: number;
  shrinkage: number;
  nozzle: number;
}

export const PROFILES: Record<ProfileId,{label:string;height:number;topW:number;topD:number;dish:number;tilt:number;draft:number}> = {
  cherry: { label: "Cherry", height: 9.4, topW: 13.0, topD: 12.2, dish: 0.9, tilt: 6, draft: 2 },
  oem: { label: "OEM", height: 10.2, topW: 13.2, topD: 12.4, dish: 0.85, tilt: 5, draft: 2 },
  xda: { label: "XDA", height: 9.0, topW: 14.0, topD: 14.0, dish: 0.7, tilt: 0, draft: 3 },
  dsa: { label: "DSA", height: 8.4, topW: 13.2, topD: 13.2, dish: 0.9, tilt: 0, draft: 4 },
  sa: { label: "SA", height: 12.5, topW: 13.6, topD: 13.0, dish: 1.2, tilt: 5, draft: 3 },
};

export const SIZES: Record<Exclude<SizeId,"custom">,{label:string;units:number}> = {
  "1u": { label: "1U", units: 1 },
  "1.25u": { label: "1.25U", units: 1.25 },
  "1.5u": { label: "1.5U", units: 1.5 },
  "1.75u": { label: "1.75U", units: 1.75 },
  "2u": { label: "2U", units: 2 },
  "2.25u": { label: "2.25U", units: 2.25 },
  "2.75u": { label: "2.75U", units: 2.75 },
  "6.25u": { label: "Spacebar 6.25U", units: 6.25 },
};

export const STAB_PRESETS = [
  { label: "2U – 23.8 mm", value: 23.8 },
  { label: "2.25U – 23.8 mm", value: 23.8 },
  { label: "2.75U – 23.8 mm", value: 23.8 },
  { label: "6.25U – 100 mm", value: 100 },
  { label: "7U – 114.3 mm", value: 114.3 },
];

export const DEFAULT_PARAMS: KeycapParams = {
  sizeId: "1u", profileId: "cherry", units: 1, pitch: 19.05,
  bottomWidth: 18, bottomDepth: 18, topWidth: 13, topDepth: 12.2, height: 9.4,
  wallThickness: 1.2, topThickness: 1.6, sideDraft: 2, cornerRadius: 1.6, topCornerRadius: 1.8,
  dishDepth: 0, dishStrength: 1.6, topTilt: 6, filletTop: 0.4,
  stemEnabled: true, stemDiameter: 5.5, stemHeight: 4, crossLength: 4.1, crossWidth: 1.35, stemClearance: 0.1,
  stabEnabled: false, stabSpacing: 23.8,
  xyCompensation: 0, zCompensation: 0, shrinkage: 0, nozzle: 0.4,
};

export const FDM_SAFE_04: Partial<KeycapParams> = {
  wallThickness: 1.6, topThickness: 1.8, cornerRadius: 1.6, stemClearance: 0.15, xyCompensation: -0.05, nozzle: 0.4, filletTop: 0.4,
};

export function applySize(p: KeycapParams, sizeId: Exclude<SizeId,"custom">): KeycapParams {
  const units = SIZES[sizeId].units;
  const bw = p.pitch * units - 1.05;
  const grow = p.pitch * (units - 1);
  return { ...p, sizeId, units, bottomWidth: round2(bw), bottomDepth: 18,
    topWidth: round2(PROFILES[p.profileId].topW + grow), topDepth: PROFILES[p.profileId].topD,
    stabEnabled: units >= 2 ? p.stabEnabled : false, stabSpacing: units >= 6 ? 100 : 23.8 };
}

export function applyProfile(p: KeycapParams, profileId: ProfileId): KeycapParams {
  const pr = PROFILES[profileId]; const grow = p.pitch * (p.units - 1);
  return { ...p, profileId, height: pr.height, topWidth: round2(pr.topW + grow), topDepth: pr.topD,
    topTilt: pr.tilt, sideDraft: pr.draft };
}

export function round2(n:number){ return Math.round(n*100)/100; }
