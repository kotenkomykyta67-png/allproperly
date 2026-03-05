import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, Button, Box, Typography, TextField, Autocomplete, Switch } from "@mui/material";
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PropertyInventoryModal from "./PropertyInventoryModal";
import Cropper from 'react-easy-crop';
import PhotoPicker from '../components/PhotoPicker';
import getCroppedImg from '../services/getCroppedImg';
import InputAdornment from '@mui/material/InputAdornment';
import { format as formatDateFns, parse as parseDateFns, isValid as isValidDateFns } from 'date-fns';
import { getAuth } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import buildPropertyModel from '../utils/buildPropertyModel';
import { Dialog as MuiDialog } from '@mui/material';
import EditPropertyModal from './EditPropertyModal';
import type { PropertyData } from './EditPropertyModal';

// Types
import type { StructuredAddress } from "../components/AddressAutocompleteAddProperty";
import AddressAutocompleteAddProperty from "../components/AddressAutocompleteAddProperty";

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
  onPropertyAdded?: (propertyId: string) => void;
}

function formatNumber(num: string | number | undefined): string {
  if (num === undefined || num === null || num === '') return '';
  const n = typeof num === 'string' ? parseFloat(num.replace(/[^\d.\-]/g, '')) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-US');
}

// Parse date from "Nov 15, 2025" format
function parseLongDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

const states = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const AddPropertyModal: React.FC<AddPropertyModalProps> = ({ open, onClose, onPropertyAdded }) => {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [address, setAddress] = useState("");
  const [addressObj, setAddressObj] = useState<StructuredAddress | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null); // Cropped preview URL
  const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null); // Cropped blob
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob | null>(null); // Original image blob
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerImage, setPhotoPickerImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [editingPaidOffDate, setEditingPaidOffDate] = useState<Date | null>(null);
  const [editingTaxDate, setEditingTaxDate] = useState<Date | null>(null);
  const [taxDateError, setTaxDateError] = useState<string>('');
  const [editingTaxAmount, setEditingTaxAmount] = useState<string>('');

  const [form, setForm] = useState<{
    propertyName: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    noMortgage: boolean;
    price: string | null;
    date: string;
    interestRate: string | null;
    balance: string | null;
    lender: string;
    yearBuilt: number | null;
    squareFeet: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    lotSize: number | null;
    estimatedValue: string | null;
    inventory: string[];
    isRental: boolean;
    photoUrl: string;
    originalPhotoUrl: string;
    pm_company: string;
    pm_rate: string;
    propertyTaxHistory?: Array<{ date: string; amount: string }>;
    mortgagePaidOffDate: string;
    mortgagePaymentAmount: string;
    hoa?: string;
    yearly?: string;
    term?: string;
    isPT?: boolean;
    pmi?: string;
    insurance?: { amount?: string; frequency?: string; dueDate?: string };
    leaseStart?: string;
    leaseEnd?: string;
    rentalRate?: number | null;
    securityDeposit?: string;
    securityDepositReceivedDate?: string;
  }>({
    propertyName: "",
    address1: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    noMortgage: false,
    price: null,
    date: "",
    interestRate: null,
    balance: null,
    lender: "",
    yearBuilt: null,
    squareFeet: null,
    bedrooms: null,
    bathrooms: null,
    lotSize: null,
    estimatedValue: null,
    inventory: [] as string[],
    propertyTaxHistory: [],
    mortgagePaymentAmount: "",
    mortgagePaidOffDate: "",
    isRental: false,
    photoUrl: "",
    originalPhotoUrl: "",
    pm_company: "",
    pm_rate: "",
    term: "",
    hoa: "",
    yearly: "",
    pmi: "",
    isPT: false,
    insurance: { amount: '', frequency: '', dueDate: '' }
  });
  const [relation, setRelation] = useState<string>('');
  const [attomData, setAttomData] = useState<any>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [addressValidTimer, setAddressValidTimer] = useState<NodeJS.Timeout | null>(null);
  const [showPropertyNameError, setShowPropertyNameError] = useState(false);
  const [propertyNameExistsError, setPropertyNameExistsError] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [firstmodal, setFirstModal] = useState(false);
  const [pmCompanyLocal, setPmCompanyLocal] = useState('');
  const [pmNewProperty, setPmNewProperty] = useState<PropertyData | null>(null);

  // Reset state on open/close
  useEffect(() => {
    setFirstModal(true);
    if (!open) {
      setTimeout(() => {
        setStep(0);
        setAddress("");
        setAddressObj(null);
        setForm({
          propertyName: "",
          address1: "",
          city: "",
          state: "",
          zip: "",
          country: "",
          price: null,
          date: "",
          interestRate: null,
          balance: null,
          lender: "",
          yearBuilt: null,
          squareFeet: null,
          noMortgage: false,
          bedrooms: null,
          bathrooms: null,
          lotSize: null,
          estimatedValue: null,
          inventory: [] as string[],
          isRental: false,
          photoUrl: "",
          originalPhotoUrl: "",
          propertyTaxHistory: [],
          mortgagePaymentAmount: "",
          mortgagePaidOffDate: "",
          pm_company: "",
          pm_rate: "",
          term: "",
          hoa: "",
          yearly: ""
        });
        setAttomData(null);
        setShowPropertyNameError(false);
        setPropertyNameExistsError(false);
        setPmCompanyLocal('');
        setSelectedImage(null);
        setImageDialogOpen(false);
        setCroppedAreaPixels(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setIsSaving(false);
        setEditingTaxDate(null);
        setEditingTaxAmount('');
        setRelation('');
        setPmNewProperty(null);
      }, 300); // Delay to allow modal to fully close
      setFirstModal(false);
    }
  }, [open]);

  // Address validation delay
  useEffect(() => {
    if (addressObj && addressObj.full) {
      if (addressValidTimer) clearTimeout(addressValidTimer);
      const timer = setTimeout(() => setCanProceed(true), 1500);
      setAddressValidTimer(timer);
    } else {
      setCanProceed(false);
      if (addressValidTimer) clearTimeout(addressValidTimer);
                      }
    return () => { if (addressValidTimer) clearTimeout(addressValidTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressObj && addressObj.full]);

  // Crop/zoom reset
  useEffect(() => {
    if (imageDialogOpen && selectedImage) {
      const img = new window.Image();
      img.src = selectedImage;
      img.onload = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
                            }
  }, [imageDialogOpen, selectedImage]);

  // Auto-populate tax fields from propertyTaxHistory
  useEffect(() => {
    const taxHistory = form?.propertyTaxHistory || [];
    if (taxHistory.length > 0 && !editingTaxDate && !editingTaxAmount) {
      // Sort by date to get the most recent tax info
      const sortedTaxes = [...taxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestTax = sortedTaxes[0];
      
      // Set the tax date if not already set
      if (latestTax.date) {
        const parsedDate = parseLongDate(latestTax.date);
        if (parsedDate) {
          setEditingTaxDate(parsedDate);
        }
      }
      
      // Set the tax amount if not already set
      if (latestTax.amount) {
        setEditingTaxAmount(latestTax.amount.toString());
      }
    }
  }, [form?.propertyTaxHistory]);

  // Crop and set image logic
  const handleCropSave = async () => {
    if (selectedImage && croppedAreaPixels) {
      try {
        const croppedImg = await getCroppedImg(selectedImage, croppedAreaPixels);
        setSelectedImage(croppedImg);
      } catch (err) {}
    }
    setImageDialogOpen(false);
  };

  // Modal UI
  return (
    <>
      {/* Step 0: Address entry modal */}
      <Dialog open={open && step === 0 && firstmodal} onClose={onClose} maxWidth="md" >
        <DialogContent sx={{ p: 4 }}>
          <>
            <Box sx={{ mb: 3, mt: 1, display: 'flex', width: "sm", alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5" sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, textAlign: 'left', ml: 0 }}>Add Property</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 400, fontSize: 16 }}>Rental Property</Typography>
                <Switch
                  checked={form?.isRental}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(f => f ? { ...f, isRental: checked } : f);
                  }}
                  inputProps={{ 'aria-label': 'Rental Property toggle' }}
                  sx={{
                    ml: 1,
                    width: 40,
                    height: 24,
                    p: 0,
                    display: 'flex',
                    alignItems: 'center',
                    '& .MuiSwitch-switchBase': {
                      top: '50%',
                      transform: 'translateY(-50%)',
                      '&.Mui-checked': {
                        transform: 'translateX(14.5px) translateY(-50%)',
                        color: '#fff',
                        '& + .MuiSwitch-track': {
                          backgroundColor: '#89AE99',
                          opacity: 1,
                        },
                      },
                    },
                    '& .MuiSwitch-thumb': {
                      width: 15,
                      height: 15,
                      boxShadow: 'none',
                      backgroundColor: '#fff',
                      transition: 'all 0.3s',
                      position: 'relative',
                      top: '0px',
                      left: '-3px',
                    },
                    '& .MuiSwitch-track': {
                      borderRadius: 18,
                      backgroundColor: '#A6A6A6',
                      opacity: 1,
                      transition: 'all 0.3s',
                    },
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ width: '100%' }}>
              <AddressAutocompleteAddProperty
                value={address}
                onChange={async (addr: StructuredAddress) => {
                  setAddress(addr.full || "");
                  setAddressObj(addr);
                  if (addr && addr.street && addr.city && addr.state && addr.zip) {
                    try {
                      const response = await fetch("https://getattompropertydetailshttp-kgqlakneiq-uc.a.run.app/getAttomPropertyDetails", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          address: addr.street,
                          city: addr.city,
                          state: addr.state,
                          zip: addr.zip
                        })
                      });
                      const result = await response.json();
                      console.log("=== FULL ATTOM API Response ===", result);
                      console.log("Response keys:", Object.keys(result || {}));
                      console.log("Tax field exists?:", result?.tax);
                      console.log("Full response structure:", JSON.stringify(result, null, 2));
                      setAttomData(result);
                    } catch (err) {
                      console.log(err);
                    }
                  }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1 }}>
                <Button
                  variant="contained"
                  sx={{ fontSize: 16, fontFamily: 'Nunito, Arial, sans-serif', textTransform: 'none', bgcolor: '#89AE99', color: '#fff', minWidth: 120, height: 48, borderRadius: 2, px: 0 }}
                  disabled={!canProceed}
                  onClick={() => {
                    if (!addressObj) return;
                    setForm(f => {
                      if (attomData) {
                        const propertyTaxHistory = attomData?.assessment?.tax && (attomData.assessment.tax.taxAmt || attomData.assessment.tax.taxYear) ? [{
                          date: `Nov 15, ${attomData.assessment.tax.taxYear || new Date().getFullYear()}`,
                          amount: `${attomData.assessment.tax.taxAmt || 0}`,
                          taxAmt: attomData.assessment.tax.taxAmt || 0,
                          taxPerSizeUnit: attomData.assessment.tax.taxPerSizeUnit || 0,
                          taxYear: attomData.assessment.tax.taxYear || new Date().getFullYear()
                        }] : [];
                        return {
                          ...f,
                          address1: attomData.address?.line1 || addressObj.street || "",
                          city: attomData.address?.locality || addressObj.city || "",
                          state: attomData.address?.countrySubd || addressObj.state || "",
                          zip: attomData.address?.postal1 || addressObj.zip || "",
                          price: attomData.sale?.saleAmountData?.saleAmt?.toString() || "",
                          date: attomData.sale?.saleTransDate || "",
                          balance: attomData.assessment?.mortgage?.FirstConcurrent?.amount?.toString() || "",
                          lender: attomData.assessment?.mortgage?.FirstConcurrent?.lenderLastName || "",
                          bedrooms: attomData?.building?.rooms?.beds || "",
                          bathrooms: attomData?.building?.rooms?.bathsFull || "",
                          squareFeet: attomData?.building?.size?.livingSize || "",
                          yearBuilt: attomData?.summary?.yearBuilt || "",
                          estimatedValue: attomData?.assessment?.assessed?.assdTtlValue || attomData?.assessment?.assessed?.assdTtlValue || "",
                          yearly: 'Yearly',
                          propertyTaxHistory: propertyTaxHistory || []
                        };
                      } else {
                        return {
                          ...f,
                          address1: addressObj.street || "",
                          city: addressObj.city || "",
                          state: addressObj.state || "",
                          zip: addressObj.zip || "",
                          country: addressObj.country || "",
                          yearly: 'Yearly',
                        };
                      }
                    });
                    setStep(1);
                    setFirstModal(false);
                  }}
                >
                  Next
                </Button>
              </Box>
            </Box>
          </>
        </DialogContent>
      </Dialog>

      {/* Step 1: Relation to Property Modal */}
      <Dialog open={open && step === 1} onClose={onClose} maxWidth="md" PaperProps={{ sx: { width: { xs: '90%', sm: '580px' }, maxWidth: '580px', borderRadius: 1 } }}>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3, mt: 1 }}>
            <Typography variant="h5" sx={{ textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, textAlign: 'left', ml: 0 }}>Relation to Property</Typography>
          </Box>
          <Autocomplete
            options={["Homeowner", "Property Manager", "Family Member"]}
            value={relation}
            onChange={(_e, val) => setRelation(val || '')}
            fullWidth
            renderInput={(params) => (
              <TextField {...params} label="I am the..." fullWidth variant="outlined" sx={{ fontFamily: 'Nunito, Arial, sans-serif' }} />
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => { setStep(0); setFirstModal(true); }} sx={{ borderRadius: 2, background: '#fff', color: '#343748', fontSize: 16, fontFamily: 'Nunito, Arial, sans-serif', border: '1.5px solid #D9D9D9', textTransform: 'none', minWidth: 120, height: 48, '&:hover': { background: '#f5f5f5', borderColor: '#B0B8C1' } }}>Back</Button>
            <Button variant="contained" disabled={!relation} onClick={() => {
              setStep(2);
              setFirstModal(false);
            }} sx={{ borderRadius: 2, background: '#89AE99', color: '#fff', textTransform: 'none', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16, minWidth: 120, height: 48, px: 0 }}>Next</Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Step 2: Property Inventory Modal (has its own Dialog) */}
      {step === 2 && (
        <PropertyInventoryModal
          open={open && step === 2}
          onClose={onClose}
          onFinish={async (selected) => {
            setForm(f => ({ ...f, inventory: selected }));
            if (relation === 'Property Manager' || relation === 'Family Member') {
              // Build local PropertyData (don't save to Firebase until final Save)
              const ownerId = getAuth().currentUser?.uid || '';
              const updatedForm = { ...form, inventory: selected, propertyName: form.propertyName || '' };
              const propertyModel = buildPropertyModel({ form: updatedForm, attomData, ownerId });
              propertyModel.ownerId = '';
              const sharedRole = relation === 'Property Manager' ? 'PM' : 'Family Manager';
              propertyModel.sharedWith = [{ userId: ownerId, role: sharedRole, alias: '' }];
              setPmNewProperty({ ...propertyModel, id: '' } as PropertyData);
              setStep(3);
            } else {
              setStep(3);
            }
          }}
        />
      )}

      {/* Step 3 PM/Family: use EditPropertyModal component in add mode */}
      {open && step === 3 && (relation === 'Property Manager' || relation === 'Family Member') && pmNewProperty && (
        <EditPropertyModal
          open={true}
          onClose={onClose}
          property={pmNewProperty}
          role={relation === 'Property Manager' ? 'pm' : 'owner'}
          mode="add"
          onSave={async (updatedData) => {
            try {
              const ownerId = getAuth().currentUser?.uid || '';
              const editBlob = (updatedData as any)._editImageBlob as Blob | undefined;
              const origBlob = (updatedData as any)._originalImageBlob as Blob | undefined;

              // Start with the base property model and merge edited fields
              const propertyModel: any = { ...pmNewProperty };
              delete propertyModel.id;

              // Common fields (both PM and Family Member)
              propertyModel.type = updatedData.type || propertyModel.type || '';
              propertyModel.address1 = updatedData.address1 || propertyModel.address1;
              propertyModel.city = updatedData.city || propertyModel.city;
              propertyModel.state = updatedData.state || propertyModel.state;
              propertyModel.zip = updatedData.zip || propertyModel.zip;
              propertyModel.bedrooms = updatedData.bedrooms ? parseInt(String(updatedData.bedrooms)) : propertyModel.bedrooms;
              propertyModel.bathsTotal = updatedData.bathsTotal ? parseFloat(String(updatedData.bathsTotal)) : propertyModel.bathsTotal;
              propertyModel.squareFeet = updatedData.squareFeet ? parseInt(String(updatedData.squareFeet)) : propertyModel.squareFeet;
              propertyModel.yearBuilt = updatedData.yearBuilt || propertyModel.yearBuilt;
              propertyModel.pm_company = updatedData.pm_company || propertyModel.pm_company || '';
              propertyModel.pm_rate = updatedData.pm_rate || propertyModel.pm_rate || '';
              propertyModel.leaseStart = updatedData.leaseStart || null;
              propertyModel.leaseEnd = updatedData.leaseEnd || null;
              propertyModel.rentalRate = updatedData.rentalRate || null;
              propertyModel.securityDeposit = updatedData.securityDeposit || null;
              propertyModel.securityDepositDate = updatedData.securityDepositDate || null;

              // Owner-style fields (Family Member gets these via owner role)
              if (updatedData.isRental !== undefined) propertyModel.isRental = updatedData.isRental;
              if (updatedData.price !== undefined) propertyModel.price = updatedData.price || '';
              if (updatedData.date !== undefined) propertyModel.date = updatedData.date || '';
              if (updatedData.noMortgage !== undefined) propertyModel.noMortgage = updatedData.noMortgage;
              if (updatedData.interestRate !== undefined) propertyModel.interestRate = updatedData.interestRate || '';
              if (updatedData.balance !== undefined) propertyModel.balance = updatedData.balance || '';
              if (updatedData.lender !== undefined) propertyModel.lender = updatedData.lender || '';
              if (updatedData.term !== undefined) propertyModel.term = updatedData.term || '';
              if (updatedData.mortgagePaymentAmount !== undefined) propertyModel.mortgagePaymentAmount = updatedData.mortgagePaymentAmount || '';
              if (updatedData.mortgagePaidOffDate !== undefined) propertyModel.mortgagePaidOffDate = updatedData.mortgagePaidOffDate || '';
              if (updatedData.hoa !== undefined) propertyModel.hoa = updatedData.hoa || '';
              if (updatedData.yearly !== undefined) propertyModel.yearly = updatedData.yearly || '';
              if (updatedData.isPT !== undefined) propertyModel.isPT = updatedData.isPT;
              if (updatedData.insurance !== undefined) propertyModel.insurance = updatedData.insurance;

              // Update alias in sharedWith to match Property Tag
              const aliasValue = updatedData.type || updatedData.alias || '';
              if (aliasValue && Array.isArray(propertyModel.sharedWith)) {
                propertyModel.sharedWith = propertyModel.sharedWith.map((sw: any) => {
                  if (sw.userId === ownerId) return { ...sw, alias: aliasValue };
                  return sw;
                });
              }

              // Create property in Firebase
              const { collection: fbCollection, addDoc } = await import('firebase/firestore');
              const { db } = await import('../services/firebase');
              const docRef = await addDoc(fbCollection(db, 'properties'), propertyModel);
              const newPropertyId = docRef.id;

              // Upload images if any
              if (editBlob || origBlob) {
                try {
                  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                  const { doc: fbDoc, updateDoc } = await import('firebase/firestore');
                  const stor = getStorage();
                  let photoUrl = '';
                  let originalPhotoUrl = '';
                  const uploadTasks: Promise<void>[] = [];
                  if (origBlob) {
                    uploadTasks.push((async () => {
                      const origRef = ref(stor, `properties/${newPropertyId}/original.jpg`);
                      await uploadBytes(origRef, origBlob);
                      originalPhotoUrl = (await getDownloadURL(origRef)) + `?t=${Date.now()}`;
                    })());
                  }
                  if (editBlob) {
                    uploadTasks.push((async () => {
                      const imgRef = ref(stor, `properties/${newPropertyId}/photo.jpg`);
                      await uploadBytes(imgRef, editBlob);
                      photoUrl = (await getDownloadURL(imgRef)) + `?t=${Date.now()}`;
                    })());
                  }
                  await Promise.all(uploadTasks);
                  const updateFields: any = {};
                  if (photoUrl) updateFields.photoUrl = photoUrl;
                  if (originalPhotoUrl) updateFields.originalPhotoUrl = originalPhotoUrl;
                  if (Object.keys(updateFields).length > 0) {
                    await updateDoc(fbDoc(db, 'properties', newPropertyId), updateFields);
                  }
                } catch (err) { /* handle image upload error silently */ }
              }

              // Create default and inventory-related tasks
              try {
                const taskTemplates = (await import('../context/task.json')).default;
                const { getNextUniqueTasks } = await import('../utils/taskRecurringHelpers');
                const inventoryTypes = Array.isArray(propertyModel.inventory) ? propertyModel.inventory : [];
                const inventoryTypeSet = new Set(inventoryTypes.map((i: string) => (typeof i === 'string' ? i.split(' - ')[0] : i)));
                const defaultTasks = taskTemplates.filter((t: any) => !t.inventory);
                const inventoryTasks = taskTemplates.filter((t: any) => t.inventory && inventoryTypeSet.has(t.inventory));
                const allTasks = [...defaultTasks, ...inventoryTasks];
                const nextTasks = getNextUniqueTasks(allTasks);
                const now = new Date().toISOString();
                await Promise.all(nextTasks.map((template: any) => {
                  const newTask = {
                    title: template.title, type: template.type, description: template.description,
                    startDate: template.startDate, dueDate: template.dueDate, frequency: template.frequency,
                    interval: template.interval, propertyId: newPropertyId, ownerId: propertyModel.ownerId || '', status: 'pending',
                    createdAt: now, updatedAt: now, assigned_user: null, completedBy: '',
                    inventory: template.inventory || '',
                  };
                  return addDoc(fbCollection(db, 'tasks'), newTask);
                }));
              } catch (err) { /* silently handle */ }

              if (onPropertyAdded) onPropertyAdded(newPropertyId);
            } catch (err) {
              console.error('Failed to create property:', err);
              alert('Failed to save property. Please try again.');
              throw err; // Re-throw so EditPropertyModal keeps modal open
            }
          }}
        />
      )}

      {/* Step 3: Edit Property Modal (Homeowner only) */}
      <Dialog open={open && step === 3 && relation !== 'Property Manager' && relation !== 'Family Member'} onClose={onClose} maxWidth="md">
        <DialogContent sx={{ p: 4 }}>
          <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 20, fontWeight: 550, mb: 2, ml: -3, mt: -2.5 }}>Edit Property</DialogTitle>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: { xs: '100%', sm: '60%' }, minWidth: 180 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', mb: 2, gap: 2 }}>
                    <Box sx={{ width: '60%', minWidth: 120 }}>
                      <Box sx={{ width: '100%', Ratio: '16/9', bgcolor: '#ededed', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <Box
                          sx={{ width: '100%', aspectRatio: '16/9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                          onClick={() => {
                            const imageToEdit = form?.originalPhotoUrl || form?.photoUrl || '/empty-property.png';
                            // If the image is the default placeholder, open file picker directly
                            if (!imageToEdit || imageToEdit === '/empty-property.png') {
                              fileInputRef.current?.click();
                            } else {
                              setPhotoPickerImage(imageToEdit);
                              setShowPhotoPicker(true);
                            }
                          }}
                        >
                          {editImage ? (
                            <img src={editImage} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <img src={ '/empty-property.png'} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ width: '40%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1 }}>
                      <Button variant="outlined" size="small" sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        fontSize: '0.95rem',
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        background: '#fff',
                        border: '1px solid #6A7F91',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        color: '#212121',
                        minWidth: 0,
                        mt: 6.5,
                        '&:hover': {
                          background: '#f5f5f5',
                          border: '1.5px solid #6A7F91',
                        },
                      }} onClick={e => { e.stopPropagation(); if (fileInputRef.current) fileInputRef.current.click(); }}>
                        <span style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                          <svg width="20" height="20" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                            <path d="M4.92632 6.4436H4.30432C2.94766 6.4436 1.84766 7.5436 1.84766 8.90026L1.84766 12.1503C1.84766 13.5063 2.94766 14.6063 4.30432 14.6063H11.7243C13.081 14.6063 14.181 13.5063 14.181 12.1503V8.8936C14.181 7.54093 13.0843 6.4436 11.7317 6.4436H11.103" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8.01424 1.91456V9.94189" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6.07092 3.86676L8.01426 1.91476L9.95826 3.86676" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                        <span style={{ color: '#212121', fontWeight: 400, fontSize: '0.9rem' }}>Change Image</span>
                      </Button>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.tif,.tiff,.webp"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setOriginalImageBlob(file);
                          const reader = new FileReader();
                          reader.onload = () => {
                            setPhotoPickerImage(reader.result as string);
                            setShowPhotoPicker(true);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                      <Dialog open={showPhotoPicker && !!photoPickerImage} onClose={() => {
                        setShowPhotoPicker(false);
                        setPhotoPickerImage(null);
                      }} maxWidth="md" fullWidth transitionDuration={{ enter: 0, exit: 0 }} keepMounted={false}>
                        <Box>
                          {photoPickerImage && (
                            <PhotoPicker
                              aspect={16 / 9}
                              imageSrc={photoPickerImage}
                              onCropped={async (blob, previewUrl) => {
                                setShowPhotoPicker(false);
                                setPhotoPickerImage(null);
                                if (blob && previewUrl) {
                                  setEditImage(previewUrl);
                                  setEditImageBlob(blob);
                                } else {
                                  // Defensive: show error if crop failed
                                  alert('Failed to crop image. Please try again.');
                                }
                              }}
                              onClose={() => {
                                setShowPhotoPicker(false);
                                setPhotoPickerImage(null);
                              }}
                            />
                          )}
                        </Box>
                      </Dialog>
                    </Box>
                  </Box>
                </Box>
                {/* 2x2 grid for Bedrooms, Bathrooms, Square Ft, Year Built */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  mb: 2,
                  ml: 3,
                  width: { xs: '100%', sm: '40%' },
                  minWidth: 220,
                }}>
                  <TextField
                    label="Bedrooms"
                    placeholder="e.g. 3"
                    fullWidth
                    value={form?.bedrooms !== undefined && form?.bedrooms !== null ? String(form.bedrooms) : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setForm(f => f ? { ...f, bedrooms: val ? Number(val) : null } : f);
                    }}
                    sx={{ bgcolor: '#fff' }}
                    inputProps={{ inputMode: 'numeric', maxLength: 2 }}
                  />
                  <TextField
                    label="Bathrooms"
                    placeholder="e.g. 4"
                    fullWidth
                    value={form?.bathrooms !== undefined && form?.bathrooms !== null ? String(form.bathrooms) : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d.]/g, '');
                      setForm(f => f ? { ...f, bathrooms: val ? Number(val) : null } : f);
                    }}
                    sx={{ bgcolor: '#fff' }}
                    inputProps={{ inputMode: 'decimal', maxLength: 2 }}
                  />
                  <TextField
                    label="Square Ft"
                    placeholder="e.g. 1200"
                    fullWidth
                    value={form?.squareFeet !== undefined && form?.squareFeet !== null ? String(form.squareFeet) : ''}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setForm(f => f ? { ...f, squareFeet: val ? Number(val) : 0 } : f);
                    }}
                    sx={{ bgcolor: '#fff', mt: 3}}
                    inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  />
                  <Autocomplete
                    options={(() => {
                      const currentYear = new Date().getFullYear();
                      const years = [];
                      for (let y = currentYear; y >= 1800; y--) years.push(String(y));
                      return years;
                    })()}
                    value={form?.yearBuilt ? String(form.yearBuilt) : ''}
                    onChange={(_e, newValue) => {
                      const year = Number(newValue);
                      const currentYear = new Date().getFullYear();
                      if (!year || year > currentYear) return;
                      setForm(f => f ? { ...f, yearBuilt: year } : f);
                    }}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Year Built"
                        placeholder="e.g. 2015"
                        fullWidth
                        sx={{ bgcolor: '#fff' }}
                        inputProps={{ ...params.inputProps, inputMode: 'numeric', maxLength: 4 }}
                      />
                    )}
                    disableClearable
                    sx={{ mt: 3 }}
                  />
                </Box>
              </Box>
                  <MuiDialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth="sm" fullWidth transitionDuration={{ enter: 0, exit: 0 }} keepMounted={false}>
                <Box sx={{ p: 3 }}>
                  <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2 }}>Crop Image</DialogTitle>
                  {selectedImage && (
                    <Box sx={{ position: 'relative', width: '100%', height: 250, bgcolor: '#222' }}>
                      <Cropper
                        image={selectedImage}
                        crop={crop}
                        zoom={zoom}
                        aspect={1.27}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                        showGrid={false}
                        cropShape="rect"
                      />
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button variant="contained" sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: '#89AE99', color: '#fff', px: 4, py: 1.5, borderRadius: 2 }} onClick={handleCropSave}>
                      Save
                    </Button>
                  </Box>
                </Box>
              </MuiDialog>
              <Autocomplete
                freeSolo
                options={["Our Home", "Parents House", "Rental"]}
                value={form.propertyName}
                onChange={(_event, newValue) => {
                  setForm(f => ({ ...f, propertyName: newValue || "" }));
                  setPropertyNameExistsError(false);
                  setShowPropertyNameError(false);
                }}
                onInputChange={(_event, newInputValue) => {
                  setForm(f => ({ ...f, propertyName: newInputValue }));
                  setPropertyNameExistsError(false);
                  setShowPropertyNameError(false);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Property Tag"
                    placeholder="Example - Our Home, Parents House or Rental"
                    required
                    error={showPropertyNameError || propertyNameExistsError}
                    helperText={
                      showPropertyNameError
                        ? "Property Tag is required"
                        : propertyNameExistsError
                          ? "Property Name already exists"
                          : ""
                    }
                    fullWidth
                    inputProps={{ ...params.inputProps, maxLength: 15 }}
                    sx={{ fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }}
                  />
                )}
              />
              {form.isRental && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Property Management Company" fullWidth value={pmCompanyLocal} onChange={e => setPmCompanyLocal(e.target.value)} onBlur={() => setForm(f => f ? { ...f, pm_company: pmCompanyLocal } : f)} sx={{ mb: 1, flex: 1 }} inputProps={{ maxLength: 30 }} />
                  <TextField
                    label="Property Management Rate"
                    placeholder="Optional"
                    fullWidth
                    value={(() => {
                      const val = form?.pm_rate || '';
                      if (!val) return '';
                      return val.endsWith('%') ? val : val + '%';
                    })()}
                    onChange={e => {
                      let raw = e.target.value.replace(/%/g, '');
                      if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
                      if (raw.startsWith('00')) raw = raw.replace(/^0+/, '0');
                      const rateNum = parseFloat(raw);
                      // Enforce limits: 0.01 to 99.99
                      if (raw) {
                        if (rateNum < 0.01 || rateNum > 99.99) return;
                      }
                      setForm(f => f ? { ...f, pm_rate: raw } : f);
                      const input = e.target as HTMLInputElement;
                      window.requestAnimationFrame(() => {
                        input.setSelectionRange(raw.length, raw.length);
                      });
                    }}
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'decimal', pattern: '[0-9.]*', maxLength: 7, style: { textAlign: 'left' } }}
                  />
                </Box>
              )}
              <TextField label="Address" placeholder="Street address" fullWidth value={form.address1} onChange={e => setForm(f => ({ ...f, address1: e.target.value }))} sx={{ fontFamily: 'Nunito, Arial, sans-serif', mb: 1 }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="City" placeholder="City name" fullWidth value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} sx={{ flex: 1 }} />
                <Autocomplete
                  options={states}
                  value={form?.state || ''}
                  onChange={(_event, newValue) => setForm(f => f ? { ...f, state: newValue || '' } : f)}
                  renderInput={params => (
                    <TextField {...params} label="State" fullWidth sx={{ flex: 1 }} />
                  )}
                  sx={{ flex: 1 }}
                  autoHighlight
                  autoSelect
                  freeSolo={false}
                />
                <TextField label="Zip Code" fullWidth value={form?.zip || ''} onChange={e => setForm(f => f ? { ...f, zip: e.target.value } : f)} sx={{ flex: 1 }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontSize: 18, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mt: 1 }}>Purchased Price and Date</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* <TextField label="Purchased Price" placeholder="Optional" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} sx={{ flex: 1 }} /> */}
                <TextField
                  label="Purchased Price"
                  placeholder="Optional"
                  fullWidth
                  value={(() => {
                    const val = form?.price ?? '';
                    if (!val) return '';
                    // Format with $ and commas, but keep decimals
                    const [intPart, decPart] = val.split('.');
                    const formattedInt = formatNumber(intPart || '');
                    return `$${formattedInt}${decPart !== undefined ? '.' + decPart : ''}`;
                  })()}
                  onChange={e => {
                    let raw = e.target.value.replace(/[^\d.]/g, '');
                    if (raw.startsWith('-')) raw = raw.replace('-', '');
                    const parts = raw.split('.');
                    if (parts.length > 2) return;
                    // Limit before decimal to 8 digits
                    if (parts[0].length > 8) return;
                    // Limit after decimal to 2 digits
                    if (parts[1] && parts[1].length > 2) return;
                    setForm(f => f ? { ...f, price: raw } : f);
                  }}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'numeric', min: 0, maxLength: 11 }}
                />
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Purchased Date"
                    value={form?.date && isValidDateFns(parseDateFns(form.date, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(form.date, 'MM/dd/yyyy', new Date())
                      : null}
                    disableFuture
                    onChange={date => {
                      let newDate = '';
                      if (date instanceof Date && isValidDateFns(date)) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (date > today) {
                          // If future, do not update
                          date = today;
                        }
                        newDate = formatDateFns(date, 'MM/dd/yyyy');
                      }
                      setForm(f => f ? { ...f, date: newDate } : f);
                    }}
                    slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                    format="MM/dd/yyyy"
                  />
                </LocalizationProvider>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontSize: 18, fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550 }}>Mortgage Information</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 550, color: "#343748", marginRight: 8 }}>{form?.noMortgage ? 'Paid Off' : 'No Mortgage'}</span>
                  <Switch
                    checked={!!form?.noMortgage}
                    onChange={e => {
                      const checked = e.target.checked;
                      setForm(f => f ? { ...f, noMortgage: checked } : f);
                    }}
                    inputProps={{ 'aria-label': 'No Mortgage toggle' }}
                    sx={{
                      ml: 1,
                      width: 40,
                      height: 24,
                      p: 0,
                      display: 'flex',
                      alignItems: 'center',
                      '& .MuiSwitch-switchBase': {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        '&.Mui-checked': {
                          transform: 'translateX(14.5px) translateY(-50%)',
                          color: '#fff',
                          '& + .MuiSwitch-track': {
                            backgroundColor: '#B94B41',
                            opacity: 1,
                          },
                        },
                      },
                      '& .MuiSwitch-thumb': {
                        width: 15,
                        height: 15,
                        boxShadow: 'none',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s',
                        position: 'relative',
                        top: '0px',
                        left: '-3px',
                      },
                      '& .MuiSwitch-track': {
                        borderRadius: 18,
                        backgroundColor: '#A6A6A6',
                        opacity: 1,
                        transition: 'all 0.3s',
                      },
                    }}
                  />
                </Box>
              </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: form?.noMortgage ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)' }, gap: 2, alignItems: 'flex-start' }}>
            {form?.noMortgage ? (
              // When Paid Off (noMortgage = true): Show simple 2x2 grid
              <>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date You Paid House Off"
                    disableFuture
                    minDate={form?.date && isValidDateFns(parseDateFns(form.date, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(form.date, 'MM/dd/yyyy', new Date())
                      : undefined}
                    value={editingPaidOffDate || (form?.mortgagePaidOffDate ? parseLongDate(form?.mortgagePaidOffDate) : null)}
                    onChange={(date) => {
                      // Prevent selecting a paid off date before purchase date
                      let purchaseDate = form?.date && isValidDateFns(parseDateFns(form.date, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.date, 'MM/dd/yyyy', new Date())
                        : null;
                      if (purchaseDate && date && date < purchaseDate) {
                        setEditingPaidOffDate(purchaseDate);
                      } else {
                        setEditingPaidOffDate(date);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                    format="MM/dd/yyyy"
                  />
                </LocalizationProvider>
                <TextField
                  label="HOA Dues"
                  placeholder="Optional"
                  fullWidth
                  value={form?.hoa || ''}
                  onChange={e => {
                    let input = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    // Only allow 1 decimal point
                    if (parts.length > 2) return;
                    // Limit before decimal to 5 digits
                    if (parts[0].length > 5) return;
                    // Limit after decimal to 2 digits
                    if (parts[1] && parts[1].length > 2) return;
                    // Prevent value above 99999.99
                    const asNumber = parseFloat(input);
                    if (!isNaN(asNumber) && asNumber > 99999.99) return;
                    setForm(f => f ? { ...f, hoa: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 8 }}
                />
                <Autocomplete
                  options={['Monthly', 'Yearly']}
                  value={form?.yearly || ''}
                  onChange={(_event, newValue) => {
                    setForm(f => f ? { ...f, yearly: newValue || '' } : f);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="HOA Payment" inputProps={{ ...params.inputProps, readOnly: true }} />
                  )}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Property Tax Due Date"
                    value={editingTaxDate || ((() => {
                      const taxHistory = form?.propertyTaxHistory || [];
                      if (taxHistory.length === 0) return null;
                      const sortedTaxes = [...taxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      const dateStr = sortedTaxes[0].date;
                      const parsedDate = parseLongDate(dateStr);
                      return parsedDate;
                    })())}
                    maxDate={new Date()}
                    onChange={date => {
                      let newDate = null;
                      if (date instanceof Date && isValidDateFns(date)) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (date > today) {
                          // If future, do not update
                          newDate = today;
                        } else {
                          newDate = date;
                        }
                      }
                      setEditingTaxDate(newDate);
                      setTaxDateError('');
                      // Check if date already exists in other entries (not just latest)
                      if (newDate) {
                        const selectedYear = new Date(newDate).getFullYear();
                        const taxHistory = form?.propertyTaxHistory || [];
                        const yearExists = taxHistory.some((item: any) => {
                          const itemYear = new Date(item.date).getFullYear();
                          return itemYear === selectedYear;
                        });
                        if (yearExists) {
                          setTaxDateError('This Tax Year has already been recorded');
                        }
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                {taxDateError && (
                  <Typography sx={{ color: '#d32f2f', fontSize: '0.75rem', fontFamily: 'Nunito, Arial, sans-serif', mt: 0.25 }}>
                    {taxDateError}
                  </Typography>
                )}
                </Box>
                <TextField
                  label="Property Tax Amount"
                  fullWidth
                  value={editingTaxAmount}
                  onChange={(e) => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    // Limit before decimal to 7 digits
                    if (parts[0].length > 7) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setEditingTaxAmount(input);
                  }}
                  onBlur={() => {
                    if (editingTaxAmount === '' || editingTaxAmount === null) return;
                    const num = parseFloat(editingTaxAmount);
                    if (isNaN(num)) return;
                    setEditingTaxAmount(num.toFixed(2));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 10 }}
                />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Insurance Due Date"
                    value={form?.insurance?.dueDate && isValidDateFns(parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                      ? parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date())
                      : null}
                    onChange={date => {
                      if (date instanceof Date && isValidDateFns(date)) {
                        const formatted = formatDateFns(date, 'MM/dd/yyyy');
                        setForm(f => f ? { 
                          ...f, 
                          insurance: { 
                            amount: f.insurance?.amount || '',
                            frequency: f.insurance?.frequency || '',
                            dueDate: formatted 
                          } 
                        } : f);
                      } else {
                        setForm(f => f ? { 
                          ...f, 
                          insurance: { 
                            amount: f.insurance?.amount || '',
                            frequency: f.insurance?.frequency || '',
                            dueDate: '' 
                          } 
                        } : f);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          bgcolor: '#fff',
                          fontFamily: 'Nunito, Arial, sans-serif',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                <TextField
                  label="Insurance Amount"
                  fullWidth
                  value={form?.insurance?.amount || ''}
                  onChange={e => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        dueDate: f.insurance?.dueDate || '',
                        frequency: f.insurance?.frequency || '',
                        amount: input 
                      } 
                    } : f);
                  }}
                  onBlur={() => {
                    const val = form?.insurance?.amount;
                    if (!val || val === '') return;
                    const num = parseFloat(val);
                    if (isNaN(num)) return;
                    setForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        dueDate: f.insurance?.dueDate || '',
                        frequency: f.insurance?.frequency || '',
                        amount: num.toFixed(2) 
                      } 
                    } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 12 }}
                />
                <Autocomplete
                  options={['Monthly', 'Yearly']}
                  value={form?.insurance?.frequency || ''}
                  onChange={(_event, newValue) => {
                    setForm(f => f ? { 
                      ...f, 
                      insurance: { 
                        dueDate: f.insurance?.dueDate || '',
                        amount: f.insurance?.amount || '',
                        frequency: newValue || '' 
                      } 
                    } : f);
                  }}
                  fullWidth
                  renderInput={(params) => (
                    <TextField {...params} label="Insurance Payment" inputProps={{ ...params.inputProps, readOnly: true }} />
                  )}
                />
                </Box>
              </>
            ) : (
              // When No Mortgage (noMortgage = false): Show full mortgage fields
              <>
                <TextField
                  label="Interest Rate"
                  placeholder="Optional"
                  fullWidth
                  value={(() => {
                    const val = form?.interestRate || '';
                    if (!val) return '';
                    return val.endsWith('%') ? val : val + '%';
                  })()}
                  onChange={e => {
                    let raw = e.target.value.replace(/%/g, '');
                    if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
                    if (raw.startsWith('00')) raw = raw.replace(/^0+/, '0');
                    const rateNum = parseFloat(raw);
                    // Enforce limits: 0.01 to 99.99
                    if (raw) {
                      if (rateNum < 0.01 || rateNum > 99.99) return;
                    }
                    setForm(f => f ? { ...f, interestRate: raw } : f);
                    const input = e.target as HTMLInputElement;
                    window.requestAnimationFrame(() => {
                      input.setSelectionRange(raw.length, raw.length);
                    });
                  }}
                  inputProps={{ inputMode: 'decimal', pattern: '[0-9.]*', maxLength: 7, style: { textAlign: 'left' } }}
                />
                <TextField
                  label="Balance"
                  placeholder="Optional"
                  fullWidth
                  value={form?.balance || ''}
                  onChange={e => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    // Limit before decimal to 8 digits
                    if (parts[0].length > 8) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setForm(f => f ? { ...f, balance: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 11 }}
                />
                <TextField
                  label="Estimate Value"
                  placeholder="Optional"
                  fullWidth
                  value={form?.estimatedValue || ''}
                  onChange={e => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setForm(f => f ? { ...f, estimatedValue: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 9 }}
                />
                <TextField
                  label="PMI"
                  placeholder="Optional"
                  fullWidth
                  value={form?.pmi || ''}
                  onChange={e => {
                    let input = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    // Only allow 1 decimal point
                    if (parts.length > 2) return;
                    // Limit before decimal to 4 digits
                    if (parts[0].length > 4) return;
                    // Limit after decimal to 2 digits
                    if (parts[1] && parts[1].length > 2) return;
                    // Prevent value above 9999.99
                    const asNumber = parseFloat(input);
                    if (!isNaN(asNumber) && asNumber > 9999.99) return;
                    setForm(f => f ? { ...f, pmi: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 7 }}
                />
                <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1.1fr 1.6fr 0.8fr auto', gap: 2, alignItems: 'center' }}>
                  <Autocomplete
                    options={['10 Year Fixed', '15 Year Fixed', '20 Year Fixed', '30 Year Fixed', '40 Year Fixed', '50 Year Fixed']}
                    value={form?.term || ''}
                    onChange={(_event, newValue) => {
                      setForm(f => f ? { ...f, term: newValue || '' } : f);
                    }}
                    fullWidth
                    renderInput={(params) => (
                      <TextField {...params} label="Term" placeholder="Optional" />
                    )}
                  />
                  <TextField
                    label="Current Lender"
                    placeholder="Optional"
                    fullWidth
                    value={form?.lender || ''}
                    onChange={e => setForm(f => f ? { ...f, lender: e.target.value } : f)}
                    inputProps={{ maxLength: 15 }}
                  />
                  <TextField
                    label="Mortgage Payment"
                    placeholder="Optional"
                    fullWidth
                    value={form?.mortgagePaymentAmount || ''}
                    onChange={e => {
                      let input = e.target.value;
                      input = input.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      if (parts.length > 2) return;
                      // Limit before decimal to 5 digits
                      if (parts[0].length > 5) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setForm(f => f ? { ...f, mortgagePaymentAmount: input } : f);
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ inputMode: 'decimal', maxLength: 8 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 550, color: "#343748", marginRight: 5 }}>Escrow Account</span>
                    <Switch
                      checked={form?.isPT}
                      onChange={e => {
                        const checked = e.target.checked;
                        setForm(f => f ? { ...f, isPT: checked } : f);
                        if (!checked) {
                          const active = document.activeElement;
                          if (active instanceof HTMLElement) active.blur();
                        }
                      }}
                      inputProps={{ 'aria-label': 'Escrow Account toggle' }}
                      sx={{
                        ml: 1,
                        width: 40,
                        height: 24,
                        p: 0,
                        display: 'flex',
                        alignItems: 'center',
                        '& .MuiSwitch-switchBase': {
                          top: '50%',
                          transform: 'translateY(-50%)',
                          '&.Mui-checked': {
                            transform: 'translateX(14.5px) translateY(-50%)',
                            color: '#fff',
                            '& + .MuiSwitch-track': {
                              backgroundColor: '#89AE99',
                              opacity: 1,
                            },
                          },
                        },
                        '& .MuiSwitch-thumb': {
                          width: 15,
                          height: 15,
                          boxShadow: 'none',
                          backgroundColor: '#fff',
                          transition: 'all 0.3s',
                          position: 'relative',
                          top: '0px',
                          left: '-3px',
                        },
                        '& .MuiSwitch-track': {
                          borderRadius: 18,
                          backgroundColor: '#A6A6A6',
                          opacity: 1,
                          transition: 'all 0.3s',
                        },
                      }}
                    />
                  </Box>
                </Box>
                <TextField
                  label="HOA Dues"
                  placeholder="Optional"
                  fullWidth
                  value={form?.hoa || ''}
                  onChange={e => {
                    let input = e.target.value;
                    input = input.replace(/[^0-9.]/g, '');
                    const parts = input.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setForm(f => f ? { ...f, hoa: input } : f);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', maxLength: 9 }}
                  sx={{ gridColumn: { xs: '1 / -1', sm: '1 / 3' } }}
                />
                <Autocomplete
                  options={['Monthly', 'Yearly']}
                  value={form?.yearly || ''}
                  onChange={(_event, newValue) => {
                    setForm(f => f ? { ...f, yearly: newValue || '' } : f);
                  }}
                  fullWidth
                  renderInput={(params) => (
                    <TextField {...params} label="HOA Payment" inputProps={{ ...params.inputProps, readOnly: true }} />
                  )}
                  sx={{ gridColumn: { xs: '1 / -1', sm: '3 / -1' } }}
                />
              </>
            )}
          </Box>
          {!form?.noMortgage && !form?.isPT && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Property Tax Due Date"
                value={editingTaxDate || ((() => {
                  const taxHistory = form?.propertyTaxHistory || [];
                  if (taxHistory.length === 0) return null;
                  const sortedTaxes = [...taxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const dateStr = sortedTaxes[0].date;
                  const parsedDate = parseLongDate(dateStr);
                  return parsedDate;
                })())}
                maxDate={new Date()}
                onChange={date => {
                  let newDate = null;
                  if (date instanceof Date && isValidDateFns(date)) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (date > today) {
                      // If future, do not update
                      newDate = today;
                    } else {
                      newDate = date;
                    }
                  }
                  setEditingTaxDate(newDate);
                  setTaxDateError('');
                  // Check if date already exists in other entries (not just latest)
                  if (newDate) {
                    const selectedYear = new Date(newDate).getFullYear();
                    const taxHistory = form?.propertyTaxHistory || [];
                    const yearExists = taxHistory.some((item: any) => {
                      const itemYear = new Date(item.date).getFullYear();
                      return itemYear === selectedYear;
                    });
                    if (yearExists) {
                      setTaxDateError('This Tax Year has already been recorded');
                    }
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: {
                      bgcolor: '#fff',
                      fontFamily: 'Nunito, Arial, sans-serif',
                    },
                  },
                }}
              />
            </LocalizationProvider>
            <TextField
              label="Property Tax Amount"
              fullWidth
              value={editingTaxAmount}
              onChange={(e) => {
                let input = e.target.value;
                input = input.replace(/[^0-9.]/g, '');
                const parts = input.split('.');
                if (parts.length > 2) return;
                if (parts[1] && parts[1].length > 2) return;
                setEditingTaxAmount(input);
              }}
              onBlur={() => {
                if (editingTaxAmount === '' || editingTaxAmount === null) return;
                const num = parseFloat(editingTaxAmount);
                if (isNaN(num)) return;
                setEditingTaxAmount(num.toFixed(2));
              }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ inputMode: 'decimal', maxLength: 12 }}
            />
          </Box>
          )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Button
                  variant="contained"
                  sx={{
                    color: '#555',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    minWidth: 120,
                    fontSize: 18,
                    border: '1.5px solid #888',
                    fontFamily: 'Nunito, Arial, sans-serif',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': { border: '1px solid #ccc', background: '#F5F6F8' }, 
                    bgcolor: '#fff'
                  }}
                  onClick={() => {
                    onClose();
                  }}
                >
                  Cancel
                </Button>
            
                <Button variant="contained" sx={{ fontSize: 18, textTransform: 'none', bgcolor: '#89AE99', color: '#fff', px: 4, py: 1.5, borderRadius: 2, minWidth: 120 }} disabled={isSaving} onClick={async () => {
                  if (!form.propertyName) {
                    setShowPropertyNameError(true);
                    setPropertyNameExistsError(false);
                    return;
                  }
                  setShowPropertyNameError(false);
                  setPropertyNameExistsError(false);
                  // Check for duplicate property type
                  const auth = getAuth();
                  const user = auth.currentUser;
                  if (!user) {
                    return;
                  }
                  const { db } = await import("../services/firebase");
                  const q = query(collection(db, "properties"), where("ownerId", "==", user.uid), where("type", "==", form.propertyName));
                  const snapshot = await getDocs(q);
                  if (!snapshot.empty) {
                    setPropertyNameExistsError(true);
                    return;
                  }
                  // All validation passed, now start saving
                  setIsSaving(true);
                  const ownerId = getAuth().currentUser?.uid || '';
                  async function compressImageToUnder1MB(blob: Blob): Promise<Blob> {
                    const maxSize = 1024 * 1024; // 1MB
                    const maxWidth = 1280;
                    const maxHeight = 720;
                    let quality = 0.92;
                    let resultBlob = blob;
                    // Only compress/resize if over 1MB or not JPEG/WEBP
                    if (blob.size > maxSize || !['image/jpeg', 'image/webp'].includes(blob.type)) {
                      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const image = new window.Image();
                        image.onload = () => resolve(image);
                        image.onerror = reject;
                        image.src = URL.createObjectURL(blob);
                      });
                      // Resize logic
                      let targetWidth = img.width;
                      let targetHeight = img.height;
                      if (img.width > maxWidth || img.height > maxHeight) {
                        const widthRatio = maxWidth / img.width;
                        const heightRatio = maxHeight / img.height;
                        const ratio = Math.min(widthRatio, heightRatio);
                        targetWidth = Math.round(img.width * ratio);
                        targetHeight = Math.round(img.height * ratio);
                      }
                      const canvas = document.createElement('canvas');
                      canvas.width = targetWidth;
                      canvas.height = targetHeight;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                        let mimeType = 'image/webp';
                        // Try compressing until under 1MB or quality too low
                        while (quality > 0.5) {
                          const b = await new Promise<Blob | null>(res => canvas.toBlob(res, mimeType, quality));
                          if (b && b.size <= maxSize) {
                            resultBlob = b;
                            break;
                          }
                          quality -= 0.07;
                        }
                      }
                    }
                    return resultBlob;
                  }
                  (async () => {
                    setIsSaving(true);
                    let photoUrl = "";
                    let originalPhotoUrl = "";
                    let newPropertyId = "";
                    try {
                      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
                      const { db } = await import('../services/firebase');
                      console.log("=== Starting Property Save ===");
                      console.log("Form data:", form);
                      console.log("ATTOM Data:", attomData);
                      console.log("ATTOM Tax Info:", attomData?.tax);
                      const propertyModel = buildPropertyModel({ form, attomData, ownerId });
                      console.log("=== Property Model Created ===");
                      console.log("Full model:", propertyModel);
                      console.log("propertyTaxHistory in model:", propertyModel.propertyTaxHistory);
                      const docRef = await addDoc(collection(db, 'properties'), propertyModel);
                      newPropertyId = docRef.id;
                      console.log("=== Property Saved to Firebase ===");
                      console.log("New Property ID:", newPropertyId);

                      // --- Upload images if selected ---
                      if (editImageBlob || originalImageBlob) {
                        try {
                          const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                          const storage = getStorage();
                          const uploadTasks = [];
                          if (originalImageBlob) {
                            const originalRef = ref(storage, `properties/${newPropertyId}/original.jpg`);
                            uploadTasks.push((async () => {
                              const compressedOriginal = await compressImageToUnder1MB(originalImageBlob);
                              await uploadBytes(originalRef, compressedOriginal);
                              const url = await getDownloadURL(originalRef);
                              originalPhotoUrl = url + `?t=${Date.now()}`;
                            })());
                          }
                          if (editImageBlob) {
                            const imageRef = ref(storage, `properties/${newPropertyId}/photo.jpg`);
                            uploadTasks.push((async () => {
                              const compressedCropped = await compressImageToUnder1MB(editImageBlob);
                              await uploadBytes(imageRef, compressedCropped);
                              const url = await getDownloadURL(imageRef);
                              photoUrl = url + `?t=${Date.now()}`;
                            })());
                          }
                          await Promise.all(uploadTasks);
                          // Update property with photoUrl and originalPhotoUrl
                          await updateDoc(doc(db, 'properties', newPropertyId), { photoUrl, originalPhotoUrl });
                        } catch (err) {
                          // handle image upload error silently
                        }
                      }
                      // --- Add default and inventory-related tasks using getNextUniqueTasks ---
                      try {
                        const taskTemplates = (await import('../context/task.json')).default;
                        const { getNextUniqueTasks } = await import('../utils/taskRecurringHelpers');
                        const inventoryTypes = Array.isArray(form.inventory) ? form.inventory : [];
                        // Extract just the inventory type (before ' - ')
                        const inventoryTypeSet = new Set(inventoryTypes.map(i => (typeof i === 'string' ? i.split(' - ')[0] : i)));
                        const defaultTasks = taskTemplates.filter(t => !t.inventory);
                        const inventoryTasks = taskTemplates.filter(t => t.inventory && inventoryTypeSet.has(t.inventory));
                        const allTasks = [...defaultTasks, ...inventoryTasks];
                        // Use getNextUniqueTasks to get the next instance for each template
                        const nextTasks = getNextUniqueTasks(allTasks);
                        const now = new Date().toISOString();
                        await Promise.all(nextTasks.map(template => {
                          const newTask = {
                            title: template.title,
                            type: template.type,
                            description: template.description,
                            startDate: template.startDate,
                            dueDate: template.dueDate,
                            frequency: template.frequency,
                            interval: template.interval,
                            propertyId: newPropertyId,
                            ownerId,
                            status: 'pending',
                            createdAt: now,
                            updatedAt: now,
                            assigned_user: null,
                            completedBy: '',
                            inventory: template.inventory || '',
                          };
                          return addDoc(collection(db, 'tasks'), newTask);
                        }));
                      } catch (err) {
                        // handle error silently
                      }
                      if (onPropertyAdded) onPropertyAdded(newPropertyId);
                      onClose();
                    } catch (e) {
                      // handle error
                      setIsSaving(false);
                    }
                  })();
                }}>
                  {isSaving ? 'Saving' : 'Save'}
                </Button>
              </Box>
            </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddPropertyModal;
