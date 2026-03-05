// Utility to build property model from form, attomData, and userId
interface BuildPropertyModelParams {
  form: any;
  attomData: any;
  ownerId: string;
}


function buildPropertyModel({ form, attomData, ownerId }: BuildPropertyModelParams) {
  const lotAcres = attomData?.lot?.lotSize1 ? Number(attomData.lot.lotSize1) : null;
  const lotSqFt = lotAcres ? lotAcres * 43560 : null;
  const bathsFull = form.bathrooms || attomData?.building?.rooms?.bathsFull || null;
  const bathsHalf = attomData?.building?.rooms?.bathsHalf ?? 0;
  const bathsTotal = bathsFull !== null ? bathsFull + 0.5 * bathsHalf : null;
  const estimatedValue = form.estimatedValue || attomData?.assessment?.assessed?.assdTtlValue || attomData?.assessment?.assessed?.assdTtlValue || null;
  
  // Build property tax history from ATTOM data
  console.log("=== Tax Extraction Debug ===");
  console.log("attomData:", attomData);
  console.log("attomData?.assessment?.tax:", attomData?.assessment?.tax);
  console.log("attomData?.assessment?.tax?.taxAmt:", attomData?.assessment?.tax?.taxAmt);
  console.log("attomData?.assessment?.tax?.taxYear:", attomData?.assessment?.tax?.taxYear);
  
  const propertyTaxHistory = attomData?.assessment?.tax && (attomData.assessment.tax.taxAmt || attomData.assessment.tax.taxYear) ? [{
    date: `Nov 15, ${attomData.assessment.tax.taxYear || new Date().getFullYear()}`,
    amount: `${attomData.assessment.tax.taxAmt || 0}`,
    taxAmt: attomData.assessment.tax.taxAmt || 0,
    taxPerSizeUnit: attomData.assessment.tax.taxPerSizeUnit || 0,
    taxYear: attomData.assessment.tax.taxYear || new Date().getFullYear()
  }] : [];
  
  console.log("Tax data extracted:", { attomTax: attomData?.assessment?.tax, propertyTaxHistory });
  
  // Build the model object
  const model = {
    ownerId,
    address1: form.address1,
    city: form.city,
    state: form.state,
    zip: form.zip,
    country: form.country,
    price: form.price,
    date: form.date,
    interestRate: form.interestRate,
    balance: form.balance,
    lender: form.lender,
    yearBuilt: form.yearBuilt || attomData?.summary?.yearBuilt || null,
    squareFeet: form.squareFeet || attomData?.building?.size?.livingSize || null,
    bedrooms: form.bedrooms || attomData?.building?.rooms?.beds || null,
    bathsFull: bathsFull,
    bathsHalf: bathsHalf,
    bathsTotal: bathsTotal,
    lotAcres: lotAcres,
    lotSqFt: lotSqFt,
    estimatedValue: estimatedValue,
    type: form.propertyName,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sharedWith: [],
    propertyStatus: 'active',
    historyVisible: true,
    inventory: form.inventory || [],
    utilities: [
      { type: 'Electricity', company: '', number: '', link: '' },
      { type: 'Water', company: '', number: '', link: '' },
      { type: 'Gas', company: '', number: '', link: '' },
      { type: 'Trash', company: '', number: '', link: '' },
    ],
    noMortgage: form.noMortgage || false,
    isRental: form.isRental || false,
    photoUrl: form.photoUrl || '/empty-property.png',
    originalPhotoUrl: form.originalPhotoUrl !== undefined ? form.originalPhotoUrl : null,
    propertyTaxHistory: propertyTaxHistory,
    yearly: 'Yearly',
    pmi: form.pmi || "",
    isPT: form.isPT || false,
    term: form.term || "",
    hoa: form.hoa || "",
    mortgagePaymentAmount: form.mortgagePaymentAmount || "",
    mortgagePaidOffDate: form.mortgagePaidOffDate || "",
    pm_rate: form.pm_rate || "",
    pm_company: form.pm_company || "",
  };
  // Remove any undefined fields (Firestore does not allow undefined)
  const modelRecord: Record<string, any> = model;
  Object.keys(modelRecord).forEach(key => {
    if (modelRecord[key] === undefined) {
      delete modelRecord[key];
    }
  });
  return modelRecord;
}

export default buildPropertyModel;
