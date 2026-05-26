import { type TranslationType } from '../en';

export const sw: TranslationType = {
  common: {
    save: "Hifadhi Mabadiliko",
    cancel: "Ghairi",
    loading: "Inapakia...",
    success: "Imefanikiwa",
    error: "Hitilafu",
    active: "Inafanya kazi",
    inactive: "Haifanyi kazi",
    status: "Hali",
    actions: "Vitendo",
    name: "Jina",
    email: "Barua Pepe",
    phone: "Nambari ya Simu",
    address: "Anwani",
    role: "Jukumu",
    edit: "Hariri",
    delete: "Futa",
    view: "Angalia",
    unauthorized: "Upatikanaji Umekataliwa",
    retry: "Jaribu Tena",
    discard: "Tupa",
    refresh: "Imarisha Mlisho"
  },
  settings: {
    title: "Mipangilio ya Eneo la Kazi",
    subtitle: "Sanidi ujanibishaji, uaminifu wa kifaa, usajili wa bili, mitandao ya pembezoni, na mipaka ya wafanyakazi.",
    tabs: {
      general: "Mipangilio Mikuu",
      security: "Uaminifu na Usalama wa Mtandao",
      subscription: "Usajili na Malipo",
      sync: "Mlandanisho na Mtandao wa Pembezoni",
      staff: "Wafanyakazi na Ruhusa"
    },
    general: {
      branchInfo: "Vipimo vya Tawi",
      branchName: "Jina la Tawi",
      timezone: "Ukanda wa Muda",
      currency: "Sarafu Chaguomsingi",
      language: "Lugha Inayopendekezwa",
      receiptSettings: "Mipangilio ya Risiti",
      receiptHeader: "Ujumbe wa Juu wa Risiti",
      receiptFooter: "Ujumbe wa Chini wa Risiti",
      saveSuccess: "Mipangilio mikuu imesasishwa kikamilifu."
    },
    security: {
      credentials: "Vyeti vya Nodi ya Kiusalama",
      deviceUuid: "Kitambulisho cha Kudumu (UUID)",
      fingerprint: "Alama ya Ziada ya Kifaa",
      keyStorage: "Hifadhi ya Ufunguo Binafsi wa ECDSA",
      keyStorageStatus: "SALAMA NA HAWEZI KUHAMISHWA (P-256)",
      activeNonce: "Nambari ya Sahihi Inayotumika (Nonce)",
      certStatus: "Hali ya Cheti cha Kifaa",
      certIssued: "Cheti Kilitolewa",
      certExpires: "Cheti Kinamalizika",
      rotationTitle: "Mzunguko wa Funguo na Urejeshaji",
      rotationDesc: "Zungusha funguo za P-256 na utengeneze cheti kipya cha uaminifu. Hii inasasisha sahihi ya kifaa chako kwenye nodi nyingine.",
      rotateBtn: "Zungusha Vyeti vya Kifaa",
      trustRegistry: "Sajili ya Vifaa Vinavyoaminika (Edge Mesh)",
      peerDeviceId: "Kitambulisho cha Kifaa Kingine",
      peerStatus: "Hali ya Uaminifu",
      peerNonce: "Nonce ya Mwisho Iliyothibitishwa",
      peerLastSeen: "Ilionekana Mwisho",
      noPeers: "Hakuna vifaa vingine vilivyosajiliwa kwenye sajili ya uaminifu.",
      rotationSuccess: "Mzunguko wa ufunguo umekamilika kwa mafanikio!"
    },
    subscription: {
      planCard: "Mpango wa Usajili Amilifu",
      quotaMeters: "Kiwango cha Rasilimali na Matumizi",
      branchesQuota: "Matumizi ya Kiwango cha Matawi",
      staffQuota: "Matumizi ya Kiwango cha Wafanyakazi",
      terminalsQuota: "Matumizi ya Vifaa/Vituo",
      unlimited: "Bila Kikomo",
      renewalDate: "Tarehe ya Kurefusha Usajili",
      paymentHistory: "Historia ya Hivi Karibuni ya Malipo",
      lockedFeatures: "Vipengele vya Kibiashara Vilivyofungwa",
      upgradePrompt: "Fungua uwezo kamili wa mitandao ya ndani, ufungaji wa hisa za bidhaa kwenye vifaa vyote, na mlandanisho wa katalogi za matawi mengi ukitumia mpango wa Pro or Enterprise.",
      upgradeBtn: "Boresha Mpango wa Usajili",
      features: {
        mesh: "Milio ya Mishindo ya Ndani & Chaguzi za Raft",
        locking: "Ufungaji wa Hisa za Pamoja Kwenye Vifaa Vyote",
        multiBranch: "Uigaji wa Katalogi za Matawi Mengi",
        telemetry: "Utambuzi wa Muda Halisi wa Pembezoni"
      }
    },
    sync: {
      leaderCard: "Uratibu wa Kiongozi wa Eneo",
      leaderStatus: "Hali ya Uongozi wa Nodi ya Ndani",
      leader: "Nodi Kiongozi wa Tawi",
      follower: "Nodi Mfuasi wa Mlandanisho",
      peerCount: "Idadi ya Vifaa Amilifu vya Mesh",
      meshHealth: "Afya ya Mawasiliano ya Mesh ya Ndani",
      wanQuality: "Hali ya Mtandao wa WAN",
      online: "Mtandaoni (SLA Amilifu)",
      offline: "Njia ya Nje ya Mtandao",
      queuePriority: "Foleni Zenye Kipaumbele",
      queueDesc: "Miamala muhimu ya kifedha (P0) inalandanishwa mara moja; uchambuzi (P3) unasitishwa hadi mtandao uwe tulivu.",
      failoverLogs: "Kumbukumbu za Uokoaji Mtandao",
      noLogs: "Hakuna matukio ya hivi karibuni ya uokoaji yaliyorekodiwa.",
      pendingQueue: "Foleni ya Mlandanisho ya Ndani",
      logMessage: "Ujumbe wa Kumbukumbu"
    },
    staff: {
      title: "Akaunti za Wafanyakazi Waliothibitishwa",
      subtitle: "Waendeshaji na vituo vilivyoidhinishwa kusajiliwa Dar es Salaam Central.",
      ownerName: "Faraji Salum",
      addStaff: "Ongeza Mfanyakazi",
      branchAccess: "Upeo vya Tawi",
      allBranches: "Matawi Yote (Upeo wa Mmiliki)",
      deviceAuth: "Kikomo cha Uthibitishaji Kifaa",
      authStatus: "Hali ya Auth",
      roles: {
        owner: "Mmiliki wa Eneo la Kazi",
        manager: "Meneja wa Tawi",
        cashier: "Mhazini wa Kituo"
      }
    }
  }
};
