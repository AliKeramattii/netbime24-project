export const dashboardContext = Object.freeze({
  success: true,
  authenticated: true,
  user: Object.freeze({
    id: "demo-user-1",
    firstName: "علیرضا",
    lastName: "احمدی",
    displayName: "علیرضا احمدی",
    mobile: "09121234567",
    avatarUrl: null,
  }),
  account: Object.freeze({ status: "recruitment" }),
});

export const demoExistingAccount = Object.freeze({
  user: dashboardContext.user,
  account: dashboardContext.account,
  profile: Object.freeze({
    identity: Object.freeze({ birthDate: null }),
    contact: Object.freeze({
      mobile: dashboardContext.user.mobile,
      province: "تهران",
      city: "تهران",
      address: null,
      postalCode: null,
      landline: null,
      email: null,
    }),
    education: Object.freeze({
      degree: "کارشناسی",
      graduationYear: 1402,
      field: "مدیریت",
    }),
    employment: Object.freeze({
      hasHistory: true,
      records: Object.freeze([
        Object.freeze({
          companyName: "شرکت نمونه",
          jobTitle: "کارشناس فروش",
          startMonth: 1,
          startYear: 1402,
          endMonth: null,
          endYear: null,
          currentlyWorking: true,
        }),
      ]),
    }),
    referral: Object.freeze({ hasReferral: false, source: null, code: null, manager: null }),
  }),
});
