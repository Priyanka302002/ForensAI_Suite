export interface CriminalRecord {
  id: string
  name: string
  age: number
  physicalMarks: string
  physical_marks?: string
  modusOperandi: string
  modus_operandi?: string
  legalStatus: string
  legal_status?: string
  facialVectorSignature: number[]
  photoUrl?: string
  pastOffenses?: number
  warrants?: number
}

export const criminalDatabase: CriminalRecord[] = [
  {
    id: "CRIM-89241",
    name: "Ananya Rao",
    age: 25,
    physicalMarks: "Scar above left eyebrow, moon tattoo on right wrist",
    physical_marks: "Scar above left eyebrow, moon tattoo on right wrist",
    modusOperandi: "Unauthorized biometric spoofing & network infiltration",
    modus_operandi: "Unauthorized biometric spoofing & network infiltration",
    legalStatus: "Wanted - Active Warrant",
    legal_status: "Wanted - Active Warrant",
    facialVectorSignature: [
      0.82, 0.45, 0.91, 0.12, 0.78, 0.34, 0.67, 0.89, 0.23, 0.56, 0.94, 0.11, 0.43, 0.76, 0.88, 0.31,
    ],
    photoUrl: "/subject-mugshot.png",
    pastOffenses: 4,
    warrants: 2,
  },
  {
    id: "CRIM-54109",
    name: "Marcus Vance",
    age: 34,
    physicalMarks: "Linear scar across left jawline, serpent tattoo on chest",
    physical_marks: "Linear scar across left jawline, serpent tattoo on chest",
    modusOperandi: "Physical forced entry using tactical bypass equipment",
    modus_operandi: "Physical forced entry using tactical bypass equipment",
    legalStatus: "Under Surveillance",
    legal_status: "Under Surveillance",
    facialVectorSignature: [
      0.21, 0.88, 0.34, 0.76, 0.12, 0.95, 0.43, 0.22, 0.81, 0.65, 0.19, 0.73, 0.54, 0.28, 0.61, 0.90,
    ],
    photoUrl: "/placeholder-mugshot-1.png",
    pastOffenses: 6,
    warrants: 1,
  },
  {
    id: "CRIM-31087",
    name: "Elena Rostova",
    age: 29,
    physicalMarks: "Burn scar on upper left shoulder, silver ring in right cartilage",
    physical_marks: "Burn scar on upper left shoulder, silver ring in right cartilage",
    modusOperandi: "Social engineering and high-value cyber fraud",
    modus_operandi: "Social engineering and high-value cyber fraud",
    legalStatus: "Wanted - Interpol Red Notice",
    legal_status: "Wanted - Interpol Red Notice",
    facialVectorSignature: [
      0.65, 0.12, 0.78, 0.43, 0.89, 0.21, 0.95, 0.34, 0.56, 0.87, 0.29, 0.63, 0.18, 0.91, 0.47, 0.72,
    ],
    photoUrl: "/placeholder-mugshot-2.png",
    pastOffenses: 3,
    warrants: 3,
  },
  {
    id: "CRIM-77412",
    name: "Devraj Patel",
    age: 42,
    physicalMarks: "Surgical scar on right cheek bone, missing tip of left index finger",
    physical_marks: "Surgical scar on right cheek bone, missing tip of left index finger",
    modusOperandi: "Hardware frequency spoofing & heavy vehicle theft",
    modus_operandi: "Hardware frequency spoofing & heavy vehicle theft",
    legalStatus: "Parole Violation",
    legal_status: "Parole Violation",
    facialVectorSignature: [
      0.33, 0.67, 0.15, 0.82, 0.44, 0.58, 0.29, 0.91, 0.37, 0.14, 0.76, 0.49, 0.83, 0.25, 0.62, 0.19,
    ],
    photoUrl: "/placeholder-mugshot-3.png",
    pastOffenses: 8,
    warrants: 1,
  },
  {
    id: "CRIM-90124",
    name: "Sophia Martinez",
    age: 31,
    physicalMarks: "Tribal tattoo band on left forearm, prominent cheekbone structure",
    physical_marks: "Tribal tattoo band on left forearm, prominent cheekbone structure",
    modusOperandi: "Financial forgery and synthetic identity fabrication",
    modus_operandi: "Financial forgery and synthetic identity fabrication",
    legalStatus: "Suspect at Large",
    legal_status: "Suspect at Large",
    facialVectorSignature: [
      0.79, 0.41, 0.88, 0.19, 0.72, 0.38, 0.61, 0.84, 0.28, 0.52, 0.90, 0.15, 0.48, 0.71, 0.83, 0.35,
    ],
    photoUrl: "/placeholder-mugshot-4.png",
    pastOffenses: 2,
    warrants: 1,
  },
]

export const criminalRecords = criminalDatabase
export default criminalDatabase
