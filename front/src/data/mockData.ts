import type { Certificate, Client, Equipment, PatternInstrument, User } from "@/types";

export const users: User[] = [
  {
    id: "u-admin",
    name: "Administrador SIP",
    email: "admin@sipinstrumentacion.com",
    role: "admin",
    active: true
  },
  {
    id: "u-certificador",
    name: "Mailen Watther",
    email: "certificador@sipinstrumentacion.com",
    role: "certificador",
    active: true
  },
  {
    id: "u-aprobador",
    name: "Responsable Técnico",
    email: "aprobador@sipinstrumentacion.com",
    role: "aprobador",
    active: true
  },
  {
    id: "u-cliente",
    name: "Usuario Tanckoating",
    email: "calidad@tanckoating.com",
    role: "cliente",
    clientId: "c-tanckoating",
    active: true
  }
];

export const clients: Client[] = [
  {
    id: "c-tanckoating",
    name: "TANCKOATING",
    cuit: "30707022155",
    email: "calidad@tanckoating.com",
    phone: "299 000 0000",
    address: "Rincón de los Sauces, Neuquén",
    industry: "Servicios petroleros"
  },
  {
    id: "c-petrolera",
    name: "EMPRESA PETROLERA DEL NORTE",
    cuit: "30999999991",
    email: "mantenimiento@petroleranorte.com",
    phone: "299 111 2233",
    address: "Añelo, Neuquén",
    industry: "Oil & Gas"
  },
  {
    id: "c-transporte",
    name: "TRANSPORTES RINCON SUR",
    cuit: "30666111222",
    email: "administracion@trs.com",
    phone: "299 222 3344",
    address: "Rincón de los Sauces, Neuquén",
    industry: "Transporte"
  }
];

export const equipment: Equipment[] = [
  {
    id: "eq-compresor-4586",
    clientId: "c-tanckoating",
    name: "Compresor de aire cárter seco",
    typeModel: "Horizontal",
    brand: "Hernandez Hnos",
    serialNumber: "4586",
    internalCode: "TK-COMP-01",
    location: "Base operativa",
    criticality: "Alta"
  },
  {
    id: "eq-valvula-122",
    clientId: "c-tanckoating",
    name: "Válvula de seguridad",
    typeModel: "Válvula PSV",
    brand: "Genérica",
    serialNumber: "VS-122",
    internalCode: "TK-PSV-04",
    location: "Sector compresores",
    criticality: "Alta"
  },
  {
    id: "eq-manometro-8891",
    clientId: "c-petrolera",
    name: "Manómetro de presión",
    typeModel: "Analógico 0-250 PSI",
    brand: "WIKA",
    serialNumber: "M-8891",
    internalCode: "PN-MAN-12",
    location: "Planta de bombeo",
    criticality: "Media"
  },
  {
    id: "eq-caudalimetro-01",
    clientId: "c-transporte",
    name: "Caudalímetro",
    typeModel: "Electromagnético DN80",
    brand: "Endress+Hauser",
    serialNumber: "CM-7780",
    internalCode: "TRS-CM-01",
    location: "Carga de agua",
    criticality: "Media"
  }
];

export const patternInstruments: PatternInstrument[] = [
  {
    id: "p-balanza-tgb-6514",
    name: "Balanza manométrica TGB",
    serialNumber: "6514",
    certificateRef: "N° 48564/23",
    rangeValue: "0-500 Kg",
    calibrationDate: "2023-09-21",
    recalibrationDate: "2028-09-21",
    certificateUrl: "https://drive.google.com/file/d/1LnxGlBIiJVshCDXXlbC-bYgOnLHuvC7z/view",
    status: "VIGENTE"
  },
  {
    id: "p-manometro-master-220",
    name: "Manómetro patrón digital",
    serialNumber: "MD-220",
    certificateRef: "MP-220/26",
    rangeValue: "0-250 PSI",
    calibrationDate: "2026-03-15",
    recalibrationDate: "2027-03-15",
    status: "VIGENTE"
  },
  {
    id: "p-termohigrometro-01",
    name: "Termohigrómetro de referencia",
    serialNumber: "TH-01",
    certificateRef: "TH-01/25",
    rangeValue: "0-50 °C / 0-100 %HR",
    calibrationDate: "2025-05-12",
    recalibrationDate: "2026-07-12",
    status: "POR_VENCER"
  }
];

export const certificates: Certificate[] = [
  {
    id: "cert-sip-26-032",
    certificateNumber: "SIP 26-032",
    validationHash: "sip-26-032-valido",
    code: "CE-SIP-01",
    validity: "2024-10-01",
    revision: "5",
    clientId: "c-tanckoating",
    equipmentId: "eq-compresor-4586",
    purchaseOrder: "",
    calibrationDate: "2026-05-11",
    expirationDate: "2031-05-10",
    element: "Compresor de aire cárter seco",
    typeModel: "Horizontal",
    brand: "Hernandez Hnos",
    serialNumber: "4586",
    rangeValue: "185",
    unit: "PSI",
    size: "220 L",
    testType: "Prueba de presión",
    referenceMethod: "Se aplica presión (46.25 PSI) en baja durante 15' y se eleva a (185 PSI). Se verifica que no tenga pérdida durante 15'.",
    environmentalConditions: "Temperatura referencia 20 °C (± 1 °C). Presión atmosférica 998 hPa.",
    measurementUnit: "PSI",
    observations: "SIN",
    conclusions: "El elemento se encuentra apto para su uso, respetando las frecuencias de control establecidas.",
    trialResult: "Aprobado",
    trialFrequency: "60 meses",
    approvedResult: true,
    finalComments: "Ensayo conforme. Sin pérdida observable durante el período de prueba.",
    patternIds: ["p-balanza-tgb-6514"],
    pressureTests: [
      {
        id: "pt-1",
        testName: "Presión de trabajo",
        pressureValue: 185,
        unit: "PSI",
        acceptanceCriteria: "",
        result: "",
        observations: ""
      },
      {
        id: "pt-2",
        testName: "Presión de prueba N°1",
        pressureValue: 46,
        unit: "PSI",
        acceptanceCriteria: "Sin error",
        result: "Positivo",
        observations: "OK"
      },
      {
        id: "pt-3",
        testName: "Presión de prueba N°2",
        pressureValue: 93,
        unit: "PSI",
        acceptanceCriteria: "Sin error",
        result: "Positivo",
        observations: "OK"
      },
      {
        id: "pt-4",
        testName: "Presión de prueba N°3",
        pressureValue: 185,
        unit: "PSI",
        acceptanceCriteria: "Sin error",
        result: "Positivo",
        observations: "OK"
      }
    ],
    createdBy: "u-certificador",
    approvedBy: "u-aprobador",
    status: "APROBADO",
    submittedAt: "2026-05-11T12:20:00",
    approvedAt: "2026-05-11T15:40:00",
    paymentStatus: "PAGADO",
    pdfUrl: "#",
    qrUrl: "/validar/sip-26-032-valido",
    auditLog: [
      {
        id: "a1",
        userName: "Mailen Watther",
        action: "Creó el certificado",
        date: "2026-05-11 10:10"
      },
      {
        id: "a2",
        userName: "Mailen Watther",
        action: "Envió a aprobación",
        date: "2026-05-11 12:20"
      },
      {
        id: "a3",
        userName: "Responsable Técnico",
        action: "Aprobó el certificado",
        date: "2026-05-11 15:40"
      }
    ]
  },
  {
    id: "cert-sip-26-033",
    certificateNumber: "SIP 26-033",
    validationHash: "sip-26-033-pendiente",
    code: "CE-SIP-01",
    validity: "2024-10-01",
    revision: "5",
    clientId: "c-petrolera",
    equipmentId: "eq-manometro-8891",
    purchaseOrder: "OC-7781",
    calibrationDate: "2026-06-10",
    expirationDate: "2027-06-10",
    element: "Manómetro de presión",
    typeModel: "Analógico 0-250 PSI",
    brand: "WIKA",
    serialNumber: "M-8891",
    rangeValue: "0-250",
    unit: "PSI",
    size: "DN 1/2",
    testType: "Calibración manométrica",
    referenceMethod: "Comparación contra manómetro patrón digital en puntos de ascenso y descenso.",
    environmentalConditions: "Temperatura de referencia 21 °C. Presión atmosférica 1001 hPa.",
    measurementUnit: "PSI",
    observations: "Pendiente de revisión técnica.",
    conclusions: "A validar por responsable técnico.",
    trialResult: "Pendiente",
    trialFrequency: "12 meses",
    approvedResult: false,
    finalComments: "Se debe revisar la lectura del punto medio antes de aprobar.",
    patternIds: ["p-manometro-master-220", "p-termohigrometro-01"],
    pressureTests: [
      {
        id: "pt-5",
        testName: "Punto 25 %",
        pressureValue: 62.5,
        unit: "PSI",
        acceptanceCriteria: "± 1 %",
        result: "Pendiente",
        observations: "Revisar"
      },
      {
        id: "pt-6",
        testName: "Punto 50 %",
        pressureValue: 125,
        unit: "PSI",
        acceptanceCriteria: "± 1 %",
        result: "Pendiente",
        observations: "Revisar"
      },
      {
        id: "pt-7",
        testName: "Punto 100 %",
        pressureValue: 250,
        unit: "PSI",
        acceptanceCriteria: "± 1 %",
        result: "Pendiente",
        observations: "OK"
      }
    ],
    createdBy: "u-certificador",
    status: "PENDIENTE_APROBACION",
    submittedAt: "2026-06-10T18:00:00",
    paymentStatus: "PENDIENTE",
    qrUrl: "/validar/sip-26-033-pendiente",
    auditLog: [
      {
        id: "a4",
        userName: "Mailen Watther",
        action: "Creó el certificado",
        date: "2026-06-10 15:15"
      },
      {
        id: "a5",
        userName: "Mailen Watther",
        action: "Envió a aprobación",
        date: "2026-06-10 18:00"
      }
    ]
  },
  {
    id: "cert-sip-25-011",
    certificateNumber: "SIP 25-011",
    validationHash: "sip-25-011-vencido",
    code: "CE-SIP-01",
    validity: "2024-10-01",
    revision: "5",
    clientId: "c-tanckoating",
    equipmentId: "eq-valvula-122",
    purchaseOrder: "OC-552",
    calibrationDate: "2024-01-10",
    expirationDate: "2025-01-10",
    element: "Válvula de seguridad",
    typeModel: "PSV",
    brand: "Genérica",
    serialNumber: "VS-122",
    rangeValue: "0-16",
    unit: "bar",
    size: "1/2",
    testType: "Prueba de disparo",
    referenceMethod: "Ensayo de apertura y estanqueidad según protocolo interno.",
    environmentalConditions: "Temperatura de referencia 20 °C.",
    measurementUnit: "bar",
    observations: "SIN",
    conclusions: "El elemento se encontraba apto al momento de emisión.",
    trialResult: "Aprobado",
    trialFrequency: "12 meses",
    approvedResult: true,
    finalComments: "Certificado vencido. Requiere renovación.",
    patternIds: ["p-balanza-tgb-6514"],
    pressureTests: [
      {
        id: "pt-8",
        testName: "Presión de apertura",
        pressureValue: 10,
        unit: "bar",
        acceptanceCriteria: "± 3 %",
        result: "Positivo",
        observations: "OK"
      }
    ],
    createdBy: "u-certificador",
    approvedBy: "u-aprobador",
    status: "APROBADO",
    submittedAt: "2024-01-10T13:00:00",
    approvedAt: "2024-01-10T16:00:00",
    paymentStatus: "PAGADO",
    pdfUrl: "#",
    qrUrl: "/validar/sip-25-011-vencido",
    auditLog: [
      {
        id: "a6",
        userName: "Mailen Watther",
        action: "Creó el certificado",
        date: "2024-01-10 11:00"
      },
      {
        id: "a7",
        userName: "Responsable Técnico",
        action: "Aprobó el certificado",
        date: "2024-01-10 16:00"
      }
    ]
  },
  {
    id: "cert-sip-26-041",
    certificateNumber: "SIP 26-041",
    validationHash: "sip-26-041-borrador",
    code: "CE-SIP-01",
    validity: "2024-10-01",
    revision: "5",
    clientId: "c-transporte",
    equipmentId: "eq-caudalimetro-01",
    purchaseOrder: "",
    calibrationDate: "2026-06-15",
    expirationDate: "2027-06-15",
    element: "Caudalímetro electromagnético",
    typeModel: "DN80",
    brand: "Endress+Hauser",
    serialNumber: "CM-7780",
    rangeValue: "0-120",
    unit: "m3/h",
    size: "DN80",
    testType: "Verificación funcional",
    referenceMethod: "Comparación contra patrón volumétrico y lectura de salida 4-20 mA.",
    environmentalConditions: "Temperatura de referencia 22 °C.",
    measurementUnit: "m3/h",
    observations: "Borrador pendiente de completar.",
    conclusions: "",
    trialResult: "Borrador",
    trialFrequency: "12 meses",
    approvedResult: false,
    finalComments: "",
    patternIds: [],
    pressureTests: [],
    createdBy: "u-certificador",
    status: "BORRADOR",
    paymentStatus: "NO_APLICA",
    qrUrl: "/validar/sip-26-041-borrador",
    auditLog: [
      {
        id: "a8",
        userName: "Mailen Watther",
        action: "Creó borrador",
        date: "2026-06-15 09:00"
      }
    ]
  }
];
