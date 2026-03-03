import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Button,
  TextField,
  Autocomplete,
  Typography,
  Switch,
  InputAdornment,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as formatDateFns, parse as parseDateFns, isValid as isValidDateFns } from 'date-fns';
import { formatNumber, formatLongDate } from '../utils/dateUtils';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../services/firebase';
import PhotoPicker from './PhotoPicker';

// US States list
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export interface PropertyData {
  id: string;
  propertyName?: string;
  photoUrl?: string;
  originalPhotoUrl?: string;
  bedrooms?: number;
  bathsTotal?: number;
  squareFeet?: number;
  yearBuilt?: string | number;
  alias?: string;
  pm_company?: string;
  pm_rate?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  leaseStart?: string;
  leaseEnd?: string;
  rentalRate?: number;
  securityDeposit?: number;
  securityDepositDate?: string;
  sharedWith?: any[];
  ownerId?: string;
  [key: string]: any;
}

export type EditModalRole = 'owner' | 'pm';

interface EditPropertyModalProps {
  open: boolean;
  onClose: () => void;
  property: PropertyData | null;
  role: EditModalRole;
  mode?: 'edit' | 'add';
  onSave?: (updatedProperty: PropertyData) => void | Promise<void>;
  onGoToSettings?: () => void;
  onDelete?: (propertyId: string) => Promise<void>;
}

// Image compression helper - matches Property.tsx
const compressImageToUnder1MB = async (blob: Blob): Promise<Blob> => {
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
      const mimeType = 'image/webp';
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
};

const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  open,
  onClose,
  property,
  role,
  mode = 'edit',
  onSave,
  onDelete,
}) => {
  // Form state
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showNameError, setShowNameError] = useState(false);
  const [showDuplicateError, setShowDuplicateError] = useState(false);
  
  // Property Tax state
  const [editingTaxDate, setEditingTaxDate] = useState<Date | null>(null);
  const [editingTaxAmount, setEditingTaxAmount] = useState<string>('');
  const [taxDateError, setTaxDateError] = useState<string>('');
  
  // Photo picker state
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerImage, setPhotoPickerImage] = useState<string | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null);
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState<string | null>(null);
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob | null>(null);
  const [isOrigin, setIsOrigin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [showFirstDeleteConfirm, setShowFirstDeleteConfirm] = useState(false);
  const [showSecondDeleteConfirm, setShowSecondDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Shared member state
  const [isSharedMember, setIsSharedMember] = useState(false);

  // Share with Owner modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  // Helper to parse long date string (matches Property.tsx)
  const parseLongDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isValidDateFns(parsed)) return parsed;
    return null;
  };

  // Initialize form when property changes
  useEffect(() => {
    if (open && property) {
      // Extract alias for shared members (matches Property.tsx logic)
      let alias = '';
      let shared = false;
      const auth = getAuth();
      const user = auth.currentUser;
      if (user && property?.ownerId !== user.uid && Array.isArray(property?.sharedWith)) {
        const sharedEntry = property.sharedWith.find((sw: any) =>
          typeof sw === 'object' && sw.userId === user.uid
        );
        if (sharedEntry && typeof sharedEntry === 'object') {
          shared = true;
          alias = sharedEntry.alias || '';
        }
      }
      // In add mode, the user is the creator — always show all fields
      if (mode === 'add') shared = false;
      setIsSharedMember(shared);
      // Property Tag: dashboard passes it as `tag`, Firestore/Property page as `type` — normalize so both work
      const propertyTag = property.type ?? (property as any).tag ?? '';
      setForm({ ...property, alias, type: propertyTag });
      // Reset image states
      setEditImage(null);
      setEditImageBlob(null);
      setOriginalImageDataUrl(null);
      setOriginalImageBlob(null);
      setIsOrigin(false);
      // Reset tax states
      setEditingTaxDate(null);
      setEditingTaxAmount('');
      setTaxDateError('');
    }
  }, [open, property, role]);

  const handleClose = () => {
    setForm({});
    setEditImage(null);
    setEditImageBlob(null);
    setOriginalImageDataUrl(null);
    setOriginalImageBlob(null);
    setIsOrigin(false);
    setShowPhotoPicker(false);
    setPhotoPickerImage(null);
    setEditingTaxDate(null);
    setEditingTaxAmount('');
    setTaxDateError('');
    setShowShareModal(false);
    setShareEmail('');
    setShowNameError(false);
    setShowDuplicateError(false);
    onClose();
  };

  // Live duplicate name check
  const checkDuplicateName = async (name: string) => {
    setShowNameError(false);
    if (!name) {
      setShowDuplicateError(false);
      return;
    }
    if (mode !== 'add') {
      setShowDuplicateError(false);
      return;
    }
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const q = query(collection(db, 'properties'), where('ownerId', '==', user.uid), where('type', '==', name));
      const snapshot = await getDocs(q);
      setShowDuplicateError(!snapshot.empty);
    } catch {
      setShowDuplicateError(false);
    }
  };

  const handleSave = async () => {
    if (!property) return;
    if (!form?.type) {
      setShowNameError(true);
      setShowDuplicateError(false);
      return;
    }
    setShowNameError(false);
    setShowDuplicateError(false);

    // Check for duplicate property name (only when adding a new property)
    if (mode === 'add') {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const q = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.uid),
          where('type', '==', form.type)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setShowDuplicateError(true);
          return;
        }
      }
    }

    setSaving(true);

    // In add mode, just return collected form data without saving to Firebase
    if (mode === 'add') {
      try {
        const resultData: any = { ...form };
        // Compress and include image blobs so parent can upload them
        if (editImageBlob) {
          resultData._editImageBlob = await compressImageToUnder1MB(editImageBlob);
        }
        if (originalImageBlob) {
          resultData._originalImageBlob = await compressImageToUnder1MB(originalImageBlob);
        }
        if (onSave) await onSave(resultData as PropertyData);
        handleClose();
      } catch (err) {
        console.error('Error in add mode save:', err);
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const docRef = doc(db, 'properties', property.id);
      const updateData: any = {};

      // Handle image upload if new image was selected
      if (editImageBlob || originalImageBlob) {
        const uploadTasks = [];
        let originalUrl: string | null = null;
        let croppedUrl: string | null = null;

        if (originalImageBlob) {
          const originalRef = ref(storage, `properties/${property.id}/original.jpg`);
          uploadTasks.push(
            (async () => {
              try {
                const compressedOriginal = await compressImageToUnder1MB(originalImageBlob);
                await uploadBytes(originalRef, compressedOriginal);
                const url = await getDownloadURL(originalRef);
                originalUrl = url + `?t=${Date.now()}`;
              } catch (uploadErr: any) {
                console.error('[EditPropertyModal] Upload error (original):', uploadErr);
                alert('Failed to upload original image: ' + (uploadErr?.message || uploadErr));
                throw uploadErr;
              }
            })()
          );
        }
        
        if (editImageBlob) {
          const imageRef = ref(storage, `properties/${property.id}/photo.jpg`);
          uploadTasks.push(
            (async () => {
              try {
                const compressedCropped = await compressImageToUnder1MB(editImageBlob);
                await uploadBytes(imageRef, compressedCropped);
                const url = await getDownloadURL(imageRef);
                croppedUrl = url + `?t=${Date.now()}`;
              } catch (uploadErr: any) {
                console.error('[EditPropertyModal] Upload error (cropped):', uploadErr);
                alert('Failed to upload cropped image: ' + (uploadErr?.message || uploadErr));
                throw uploadErr;
              }
            })()
          );
        }

        if (uploadTasks.length > 0) {
          try {
            await Promise.all(uploadTasks);
          } catch (err) {
            setSaving(false);
            return;
          }
        }

        if (originalUrl) updateData.originalPhotoUrl = originalUrl;
        if (croppedUrl) updateData.photoUrl = croppedUrl;
      }

      // Property tax history - same logic as Property page inline edit
      let updatedPropertyTaxHistory: Array<{ date: string; amount: string }> = property?.propertyTaxHistory || [];
      if (editingTaxDate && editingTaxAmount) {
        const formattedDate = formatLongDate(editingTaxDate);
        const taxYear = new Date(editingTaxDate).getFullYear();
        let found = false;
        updatedPropertyTaxHistory = updatedPropertyTaxHistory.map((item: any) => {
          const itemYear = new Date(item.date).getFullYear();
          if (itemYear === taxYear) {
            found = true;
            return { ...item, date: formattedDate, amount: editingTaxAmount };
          }
          return item;
        });
        if (!found) {
          updatedPropertyTaxHistory = [...updatedPropertyTaxHistory, { date: formattedDate, amount: editingTaxAmount }];
        }
        updatedPropertyTaxHistory = updatedPropertyTaxHistory.sort((a, b) => {
          const yearA = new Date(a.date).getFullYear();
          const yearB = new Date(b.date).getFullYear();
          return yearB - yearA;
        });
      } else if (editingTaxDate === null && editingTaxAmount === '') {
        const sortedTaxes = [...updatedPropertyTaxHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestTax = sortedTaxes[0];
        if (latestTax) {
          updatedPropertyTaxHistory = updatedPropertyTaxHistory.filter((item: any) =>
            !(item.date === latestTax.date && item.amount === latestTax.amount)
          );
        }
      }
      updateData.propertyTaxHistory = updatedPropertyTaxHistory;

      // PM role fields
      if (role === 'pm') {
        if (form.bedrooms !== undefined) updateData.bedrooms = form.bedrooms ? parseInt(String(form.bedrooms)) : null;
        if (form.bathsTotal !== undefined) updateData.bathsTotal = form.bathsTotal ? parseFloat(String(form.bathsTotal)) : null;
        if (form.squareFeet !== undefined) updateData.squareFeet = form.squareFeet ? parseInt(String(form.squareFeet)) : null;
        if (form.yearBuilt !== undefined) updateData.yearBuilt = form.yearBuilt || null;
        if (form.pm_company !== undefined) updateData.pm_company = form.pm_company || '';
        if (form.pm_rate !== undefined) updateData.pm_rate = form.pm_rate || '';
        if (form.address1 !== undefined) updateData.address1 = form.address1 || '';
        if (form.city !== undefined) updateData.city = form.city || '';
        if (form.state !== undefined) updateData.state = form.state || '';
        if (form.zip !== undefined) updateData.zip = form.zip || '';
        if (form.leaseStart !== undefined) updateData.leaseStart = form.leaseStart || null;
        if (form.leaseEnd !== undefined) updateData.leaseEnd = form.leaseEnd || null;
        if (form.rentalRate !== undefined) updateData.rentalRate = form.rentalRate || null;
        if (form.securityDeposit !== undefined) updateData.securityDeposit = form.securityDeposit || null;
        if (form.securityDepositDate !== undefined) updateData.securityDepositDate = form.securityDepositDate || null;

        // Update alias in sharedWith array
        if (form.alias !== undefined && property.sharedWith) {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            const updatedSharedWith = property.sharedWith.map((sw: any) => {
              if (typeof sw === 'object' && sw.userId === user.uid) {
                return { ...sw, alias: form.alias || '' };
              }
              return sw;
            });
            updateData.sharedWith = updatedSharedWith;
          }
        }
      } else {
        // Owner role fields - sync all fields from form like Property.tsx
        if (form.bedrooms !== undefined) updateData.bedrooms = form.bedrooms ? parseInt(String(form.bedrooms)) : null;
        if (form.bathsTotal !== undefined) updateData.bathsTotal = form.bathsTotal ? parseFloat(String(form.bathsTotal)) : null;
        if (form.squareFeet !== undefined) updateData.squareFeet = form.squareFeet ? parseInt(String(form.squareFeet)) : null;
        if (form.yearBuilt !== undefined) updateData.yearBuilt = form.yearBuilt || null;
        if (form.type !== undefined) updateData.type = form.type || '';
        if (form.isRental !== undefined) updateData.isRental = form.isRental;
        if (form.pm_company !== undefined) updateData.pm_company = form.pm_company || '';
        if (form.pm_rate !== undefined) updateData.pm_rate = form.pm_rate || '';
        if (form.address1 !== undefined) updateData.address1 = form.address1 || '';
        if (form.city !== undefined) updateData.city = form.city || '';
        if (form.state !== undefined) updateData.state = form.state || '';
        if (form.zip !== undefined) updateData.zip = form.zip || '';
        if (form.price !== undefined) updateData.price = form.price || '';
        if (form.date !== undefined) updateData.date = form.date || '';
        if (form.noMortgage !== undefined) updateData.noMortgage = form.noMortgage;
        if (form.mortgagePaidOffDate !== undefined) {
          const paidOffStr = form.mortgagePaidOffDate || '';
          if (paidOffStr) {
            const parsed = new Date(paidOffStr);
            if (!isNaN(parsed.getTime())) {
              updateData.mortgagePaidOffDate = formatLongDate(parsed);
            } else {
              updateData.mortgagePaidOffDate = paidOffStr;
            }
          } else {
            updateData.mortgagePaidOffDate = '';
          }
        }
        if (form.interestRate !== undefined) {
          let rateRaw = (form.interestRate || '').toString().trim();
          if (rateRaw) {
            if (rateRaw.endsWith('%')) rateRaw = rateRaw.slice(0, -1);
            const rateNum = parseFloat(rateRaw);
            if (rateNum >= 0.01 && rateNum <= 99.99) {
              updateData.interestRate = `${rateNum.toFixed(2)}%`;
            } else {
              updateData.interestRate = form.interestRate || '';
            }
          } else {
            updateData.interestRate = '';
          }
        }
        if (form.balance !== undefined) updateData.balance = form.balance || '';
        if (form.estimatedValue !== undefined) updateData.estimatedValue = form.estimatedValue || '';
        if (form.pmi !== undefined) updateData.pmi = form.pmi || '';
        if (form.term !== undefined) updateData.term = form.term || '';
        if (form.lender !== undefined) updateData.lender = form.lender || '';
        if (form.mortgagePaymentAmount !== undefined) updateData.mortgagePaymentAmount = form.mortgagePaymentAmount || '';
        if (form.isPT !== undefined) updateData.isPT = form.isPT;
        if (form.hoa !== undefined) updateData.hoa = form.hoa || '';
        if (form.yearly !== undefined) updateData.yearly = form.yearly || '';
        // Lease, security deposit, insurance - same as PM so dashboard owner edit matches Property page
        if (form.leaseStart !== undefined) updateData.leaseStart = form.leaseStart || null;
        if (form.leaseEnd !== undefined) updateData.leaseEnd = form.leaseEnd || null;
        if (form.rentalRate !== undefined) updateData.rentalRate = form.rentalRate || null;
        if (form.securityDeposit !== undefined) updateData.securityDeposit = form.securityDeposit || null;
        if (form.securityDepositDate !== undefined) updateData.securityDepositDate = form.securityDepositDate || null;
        if (form.insurance !== undefined && form.insurance !== null && typeof form.insurance === 'object') {
          updateData.insurance = {
            insuranceCompany: form.insurance.insuranceCompany || '',
            assetsCovered: form.insurance.assetsCovered || '',
            policyNumber: form.insurance.policyNumber || '',
            dueDate: form.insurance.dueDate || '',
            amount: form.insurance.amount || '',
            frequency: form.insurance.frequency || '',
          };
        }
      }

      updateData.updatedAt = new Date().toISOString();

      await updateDoc(docRef, updateData);

      // Call onSave callback with updated data
      if (onSave) {
        onSave({ ...property, ...updateData });
      }

      handleClose();
    } catch (err) {
      console.error('Error updating property:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!property || !onDelete) return;
    setDeleteLoading(true);
    try {
      await onDelete(property.id);
      // Only clean up UI if component is still mounted (onDelete may redirect)
      setShowSecondDeleteConfirm(false);
      setDeleteLoading(false);
    } catch (err) {
      console.error('Error deleting property:', err);
      setDeleteLoading(false);
    }
  };

  if (!property) return null;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ px: 4, py: 1.5 }}>
        <DialogTitle sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, ml: -3 }}>
          Edit Property
        </DialogTitle>

        {/* PM Role - Full Edit Modal */}
        {role === 'pm' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 2, bgcolor: '#fff' }}>
            {/* Image region and 2x2 grid */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: { xs: '100%', sm: '60%' }, minWidth: 180 }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', mb: 2, gap: 2 }}>
                  <Box sx={{ width: '60%', minWidth: 120 }}>
                    <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: '#ededed', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <Box
                        sx={{ width: '100%', aspectRatio: '16/9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                        onClick={() => {
                          // If a new image was selected, use its original (uncropped) data URL for re-editing
                          const imageToEdit = !isOrigin ? form?.originalPhotoUrl : originalImageDataUrl || form?.photoUrl || '/empty-property.png';
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
                          <img src={form?.photoUrl || '/empty-property.png'} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ width: '40%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        fontSize: '0.95rem',
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        background: '#fff',
                        border: '1px solid #B0B8C1',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        color: '#212121',
                        minWidth: 0,
                        mt: 6.5,
                        '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' },
                      }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4.92632 6.4436H4.30432C2.94766 6.4436 1.84766 7.5436 1.84766 8.90026L1.84766 12.1503C1.84766 13.5063 2.94766 14.6063 4.30432 14.6063H11.7243C13.081 14.6063 14.181 13.5063 14.181 12.1503V8.8936C14.181 7.54093 13.0843 6.4436 11.7317 6.4436H11.103" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8.01424 1.91456V9.94189" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M6.07092 3.86676L8.01426 1.91476L9.95826 3.86676" stroke="#212121" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <span style={{ color: '#212121', fontWeight: 400, fontSize: '0.9rem' }}>Change Image</span>
                    </Button>
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.tif,.tiff,.webp"
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setOriginalImageBlob(file);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setOriginalImageDataUrl(reader.result as string);
                          setPhotoPickerImage(reader.result as string);
                          setShowPhotoPicker(true);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    {/* PhotoPicker modal */}
                    <Dialog open={showPhotoPicker && !!photoPickerImage} onClose={() => { setShowPhotoPicker(false); setPhotoPickerImage(null); }} maxWidth="md" fullWidth>
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
                                alert('Failed to crop image. Please try again.');
                              }
                              setIsOrigin(true);
                            }}
                            onClose={() => {
                              setShowPhotoPicker(false);
                              setPhotoPickerImage(null);
                              setIsOrigin(false);
                            }}
                          />
                        )}
                      </Box>
                    </Dialog>
                  </Box>
                </Box>
              </Box>

              {/* 2x2 grid for Bedrooms, Bathrooms, Square Ft, Year Built */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2, ml: 3, width: { xs: '100%', sm: '40%' }, minWidth: 220 }}>
                <TextField
                  label="Bedrooms"
                  placeholder="e.g. 3"
                  fullWidth
                  value={form?.bedrooms !== undefined && form?.bedrooms !== null ? String(form.bedrooms) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    setForm((f: any) => ({ ...f, bedrooms: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff' }}
                  inputProps={{ inputMode: 'numeric', maxLength: 2 }}
                />
                <TextField
                  label="Bathrooms"
                  placeholder="e.g. 4"
                  fullWidth
                  value={form?.bathsTotal !== undefined && form?.bathsTotal !== null ? String(form.bathsTotal) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, '');
                    setForm((f: any) => ({ ...f, bathsTotal: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff' }}
                  inputProps={{ inputMode: 'decimal', maxLength: 2 }}
                />
                <TextField
                  label="Square Ft"
                  placeholder="e.g. 1200"
                  fullWidth
                  value={form?.squareFeet !== undefined && form?.squareFeet !== null ? String(form.squareFeet) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    setForm((f: any) => ({ ...f, squareFeet: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff', mt: 3 }}
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
                    setForm((f: any) => ({ ...f, yearBuilt: year }));
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

            {/* Property Name - required for PM add mode */}
            {role === 'pm' && mode === 'add' && (
              <Autocomplete
                options={['Our Home', 'Parents House', 'Rental']}
                value={form?.type || ''}
                onChange={(_e, newValue) => {
                  const val = newValue || '';
                  setForm((f: any) => ({ ...f, type: val }));
                  setShowNameError(false);
                  checkDuplicateName(val);
                }}
                renderInput={(params) => <TextField {...params} label="Property Tag" placeholder="Example - Our Home, Parents House or Rental" fullWidth error={(showNameError && !form?.type) || showDuplicateError} inputProps={{ ...params.inputProps, maxLength: 15 }} />}
                freeSolo
              />
            )}
            {role === 'pm' && mode === 'add' && showNameError && !form?.type && (
              <Typography color="error" sx={{ fontWeight: 400, fontSize: 14 }}>
                Property Name is required
              </Typography>
            )}
            {role === 'pm' && mode === 'add' && showDuplicateError && (
              <Typography color="error" sx={{ fontWeight: 400, fontSize: 14 }}>
                A property with this name already exists
              </Typography>
            )}

            {/* Rename for me only - only for shared members (edit mode) */}
            {isSharedMember && mode !== 'add' && (
              <Box>
                <TextField
                  label="Rename for me only"
                  placeholder="Your custom name for this property"
                  fullWidth
                  value={form?.alias || ''}
                  onChange={(e) => setForm((f: any) => ({ ...f, alias: e.target.value }))}
                  inputProps={{ maxLength: 15 }}
                />
              </Box>
            )}

            {/* PM Company and Rate */}
            <Box sx={{ display: 'flex', gap: 2, mt: 0 }}>
              <TextField
                label="Property Management Company"
                fullWidth
                value={form?.pm_company || ''}
                onChange={(e) => setForm((f: any) => ({ ...f, pm_company: e.target.value }))}
                sx={{ flex: 1 }}
                inputProps={{ maxLength: 30 }}
              />
              <TextField
                label="Property Management Rate"
                placeholder="Optional"
                fullWidth
                value={(() => {
                  const val = form?.pm_rate || '';
                  if (!val) return '';
                  return val.endsWith('%') ? val : val + '%';
                })()}
                onChange={(e) => {
                  let raw = e.target.value.replace(/%/g, '');
                  if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
                  if (raw.startsWith('00')) raw = raw.replace(/^0+/, '0');
                  const rateNum = parseFloat(raw);
                  if (raw) {
                    if (rateNum < 0.01 || rateNum > 99.99) return;
                  }
                  setForm((f: any) => ({ ...f, pm_rate: raw }));
                }}
                sx={{ flex: 1 }}
                inputProps={{ inputMode: 'decimal', maxLength: 7, style: { textAlign: 'left' } }}
              />
            </Box>

            {/* Address */}
            <TextField
              label="Address"
              fullWidth
              value={form?.address1 || ''}
              onChange={(e) => setForm((f: any) => ({ ...f, address1: e.target.value }))}
              sx={{ mb: 1 }}
              inputProps={{ maxLength: 50 }}
            />

            {/* City, State, Zip */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="City"
                fullWidth
                value={form?.city || ''}
                onChange={(e) => setForm((f: any) => ({ ...f, city: e.target.value }))}
                sx={{ mb: 1, flex: 1 }}
                inputProps={{ maxLength: 15 }}
              />
              <Autocomplete
                options={US_STATES}
                value={form?.state || ''}
                onChange={(_e, newValue) => setForm((f: any) => ({ ...f, state: newValue || '' }))}
                renderInput={(params) => <TextField {...params} label="State" fullWidth sx={{ flex: 1 }} />}
                sx={{ flex: 1 }}
                autoHighlight
                autoSelect
                freeSolo={false}
              />
              <TextField
                label="Zip Code"
                fullWidth
                value={form?.zip || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  if (val.length <= 15) {
                    setForm((f: any) => ({ ...f, zip: val }));
                  }
                }}
                sx={{ flex: 1 }}
                inputProps={{ inputMode: 'numeric', maxLength: 15 }}
              />
            </Box>

            {/* Lease Tracking & Security Deposit - exactly matching Property.tsx */}
            <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
              {/* Lease Tracking */}
              <Box sx={{ width: '50%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 550, mb: 1.5, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16 }}>Lease Tracking</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Lease Starts"
                      value={form?.leaseStart && isValidDateFns(parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date())
                        : null}
                      disableFuture
                      onChange={date => {
                        let newDate = '';
                        if (date instanceof Date && isValidDateFns(date)) {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          if (date > today) {
                            date = today;
                          }
                          newDate = formatDateFns(date, 'MM/dd/yyyy');
                        }
                        setForm((f: any) => ({ ...f, leaseStart: newDate }));
                      }}
                      slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                      format="MM/dd/yyyy"
                    />
                  </LocalizationProvider>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Lease Ends"
                      minDate={form?.leaseStart && isValidDateFns(parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date())
                        : undefined}
                      value={form?.leaseEnd && isValidDateFns(parseDateFns(form.leaseEnd, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.leaseEnd, 'MM/dd/yyyy', new Date())
                        : null}
                      onChange={date => {
                        let newDate = '';
                        let leaseStartDate = form?.leaseStart && isValidDateFns(parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date()))
                          ? parseDateFns(form.leaseStart, 'MM/dd/yyyy', new Date())
                          : null;
                        if (date instanceof Date && isValidDateFns(date)) {
                          if (leaseStartDate && date <= leaseStartDate) {
                            newDate = formatDateFns(new Date(leaseStartDate.getTime() + 86400000), 'MM/dd/yyyy');
                          } else {
                            newDate = formatDateFns(date, 'MM/dd/yyyy');
                          }
                        }
                        setForm((f: any) => ({ ...f, leaseEnd: newDate }));
                      }}
                      slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                      format="MM/dd/yyyy"
                    />
                  </LocalizationProvider>
                  <TextField
                    label="Rental Rate"
                    fullWidth
                    value={(() => {
                      const val = formatNumber(form?.rentalRate ?? '');
                      return val ? `$${val}` : '';
                    })()}
                    onChange={e => {
                      let raw = e.target.value.replace(/[^\d.]/g, '');
                      if (raw.startsWith('-')) raw = raw.replace('-', '');
                      const numeric = raw === '' ? undefined : Number(raw);
                      setForm((f: any) => ({ ...f, rentalRate: numeric }));
                    }}
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'numeric', min: 0, maxLength: 8 }}
                  />
                </Box>
              </Box>

              {/* Security Deposit Information */}
              <Box sx={{ width: '50%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 550, mb: 1.5, color: '#343748', fontFamily: 'Nunito, Arial, sans-serif', fontSize: 16 }}>Security Deposit Information</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Security Deposit"
                    fullWidth
                    value={(() => {
                      const val = formatNumber(form?.securityDeposit ?? '');
                      return val ? `$${val}` : '';
                    })()}
                    onChange={e => {
                      let raw = e.target.value.replace(/[^\d.]/g, '');
                      if (raw.startsWith('-')) raw = raw.replace('-', '');
                      setForm((f: any) => ({ ...f, securityDeposit: raw }));
                    }}
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'numeric', min: 0, maxLength: 8 }}
                  />
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Received Date"
                      value={form?.securityDepositDate && isValidDateFns(parseDateFns(form.securityDepositDate, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.securityDepositDate, 'MM/dd/yyyy', new Date())
                        : null}
                      disableFuture
                      onChange={date => {
                        let newDate = '';
                        if (date instanceof Date && isValidDateFns(date)) {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          if (date > today) {
                            date = today;
                          }
                          newDate = formatDateFns(date, 'MM/dd/yyyy');
                        }
                        setForm((f: any) => ({ ...f, securityDepositDate: newDate }));
                      }}
                      slotProps={{ textField: { fullWidth: true, sx: { flex: 1, bgcolor: '#fff' } } }}
                      format="MM/dd/yyyy"
                    />
                  </LocalizationProvider>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Owner Role Modal - Full edit modal same as Property.tsx */}
        {role === 'owner' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 2, bgcolor: '#fff' }}>
            {/* Image region and 2x2 grid */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: { xs: '100%', sm: '60%' }, minWidth: 180 }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', mb: 2, gap: 2 }}>
                  <Box sx={{ width: '60%', minWidth: 120 }}>
                    <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: '#ededed', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <Box
                        sx={{ width: '100%', aspectRatio: '16/9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                        onClick={() => {
                          const imageToEdit = !isOrigin ? form?.originalPhotoUrl : originalImageDataUrl || form?.photoUrl || '/empty-property.png';
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
                          <img src={form?.photoUrl || '/empty-property.png'} alt="Property" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ width: '40%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                        fontSize: '0.95rem',
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        background: '#fff',
                        border: '1px solid #B0B8C1',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        color: '#212121',
                        minWidth: 0,
                        mt: 6.5,
                        '&:hover': { background: '#f5f5f5', borderColor: '#B0B0B0' },
                      }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setOriginalImageBlob(file);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setOriginalImageDataUrl(reader.result as string);
                          setPhotoPickerImage(reader.result as string);
                          setShowPhotoPicker(true);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <Dialog open={showPhotoPicker && !!photoPickerImage} onClose={() => { setShowPhotoPicker(false); setPhotoPickerImage(null); }} maxWidth="md" fullWidth>
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
                                alert('Failed to crop image. Please try again.');
                              }
                              setIsOrigin(true);
                            }}
                            onClose={() => {
                              setShowPhotoPicker(false);
                              setPhotoPickerImage(null);
                              setIsOrigin(false);
                            }}
                          />
                        )}
                      </Box>
                    </Dialog>
                  </Box>
                </Box>
              </Box>

              {/* 2x2 grid for Bedrooms, Bathrooms, Square Ft, Year Built */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2, ml: 3, width: { xs: '100%', sm: '40%' }, minWidth: 220 }}>
                <TextField
                  label="Bedrooms"
                  placeholder="e.g. 3"
                  fullWidth
                  value={form?.bedrooms !== undefined && form?.bedrooms !== null ? String(form.bedrooms) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    setForm((f: any) => ({ ...f, bedrooms: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff' }}
                  inputProps={{ inputMode: 'numeric', maxLength: 2 }}
                />
                <TextField
                  label="Bathrooms"
                  placeholder="e.g. 4"
                  fullWidth
                  value={form?.bathsTotal !== undefined && form?.bathsTotal !== null ? String(form.bathsTotal) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, '');
                    setForm((f: any) => ({ ...f, bathsTotal: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff' }}
                  inputProps={{ inputMode: 'decimal', maxLength: 2 }}
                />
                <TextField
                  label="Square Ft"
                  placeholder="e.g. 1200"
                  fullWidth
                  value={form?.squareFeet !== undefined && form?.squareFeet !== null ? String(form.squareFeet) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    setForm((f: any) => ({ ...f, squareFeet: val ? Number(val) : 0 }));
                  }}
                  sx={{ bgcolor: '#fff', mt: 3 }}
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
                    setForm((f: any) => ({ ...f, yearBuilt: year }));
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

            {/* Property Tag with Rental Property toggle - only for non-shared members */}
            {!isSharedMember && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Autocomplete
                    options={['Our Home', 'Parents House', 'Rental']}
                    value={form?.type || ''}
                    onChange={(_e, newValue) => {
                      const val = newValue || '';
                      setForm((f: any) => ({ ...f, type: val }));
                      setShowNameError(false);
                      checkDuplicateName(val);
                    }}
                    renderInput={(params) => <TextField {...params} label="Property Tag" placeholder="Example - Our Home, Parents House or Rental" fullWidth error={showNameError && !form?.type || showDuplicateError} inputProps={{ ...params.inputProps, maxLength: 15 }} />}
                    freeSolo
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 160 }}>
                  <span style={{ fontSize: 14, fontWeight: 550, color: '#343748', marginRight: 8 }}>Rental Property</span>
                  <Switch
                    checked={form?.isRental || false}
                    onChange={e => setForm((f: any) => ({ ...f, isRental: e.target.checked }))}
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
            </Box>
            )}
            {/* Property Name validation - owner only */}
            {!isSharedMember && showNameError && !form?.type && (
              <Typography color="error" sx={{ fontWeight: 400, fontSize: 14 }}>
                Property Name is required
              </Typography>
            )}
            {!isSharedMember && showDuplicateError && (
              <Typography color="error" sx={{ fontWeight: 400, fontSize: 14 }}>
                A property with this name already exists
              </Typography>
            )}

            {/* PM Company & PM Rate - only shown when isRental */}
            {form?.isRental && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Property Management Company"
                  fullWidth
                  value={form?.pm_company || ''}
                  onChange={e => setForm((f: any) => ({ ...f, pm_company: e.target.value }))}
                  sx={{ flex: 1, mb: 1 }}
                  inputProps={{ maxLength: 30 }}
                />
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
                    if (raw) {
                      if (rateNum < 0.01 || rateNum > 99.99) return;
                    }
                    setForm((f: any) => ({ ...f, pm_rate: raw }));
                    const input = e.target as HTMLInputElement;
                    window.requestAnimationFrame(() => {
                      input.setSelectionRange(raw.length, raw.length);
                    });
                  }}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'decimal', pattern: '[0-9.]*', maxLength: 6 }}
                />
              </Box>
            )}

            {/* Address */}
            <TextField
              label="Address"
              fullWidth
              value={form?.address1 || ''}
              onChange={(e) => setForm((f: any) => ({ ...f, address1: e.target.value }))}
              sx={{ mb: 1 }}
              inputProps={{ maxLength: 50 }}
            />

            {/* City, State, Zip */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="City"
                fullWidth
                value={form?.city || ''}
                onChange={(e) => setForm((f: any) => ({ ...f, city: e.target.value }))}
                sx={{ mb: 1, flex: 1 }}
                inputProps={{ maxLength: 15 }}
              />
              <Autocomplete
                options={US_STATES}
                value={form?.state || ''}
                onChange={(_e, newValue) => setForm((f: any) => ({ ...f, state: newValue || '' }))}
                renderInput={(params) => <TextField {...params} label="State" fullWidth sx={{ flex: 1 }} />}
                sx={{ flex: 1 }}
                autoHighlight
                autoSelect
                freeSolo={false}
              />
              <TextField
                label="Zip Code"
                fullWidth
                value={form?.zip || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  if (val.length <= 15) {
                    setForm((f: any) => ({ ...f, zip: val }));
                  }
                }}
                sx={{ flex: 1 }}
                inputProps={{ inputMode: 'numeric', maxLength: 15 }}
              />
            </Box>

            {/* Purchased Price and Date */}
            <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mt: 1, fontSize: { xs: 13, sm: 16, md: 18 } }}>
              Purchased Price and Date
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Purchased Price"
                fullWidth
                value={form?.price || ''}
                onChange={e => {
                  let input = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = input.split('.');
                  if (parts.length > 2) return;
                  if (parts[0].length > 8) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setForm((f: any) => ({ ...f, price: input }));
                }}
                sx={{ bgcolor: '#fff', flex: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
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
                        date = today;
                      }
                      newDate = formatDateFns(date, 'MM/dd/yyyy');
                    }
                    setForm((f: any) => ({ ...f, date: newDate }));
                  }}
                  slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff', flex: 1 } } }}
                  format="MM/dd/yyyy"
                />
              </LocalizationProvider>
            </Box>

            {/* Mortgage Information */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: { xs: 13, sm: 16, md: 18 } }}>
                Mortgage Information
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 550, color: '#343748', marginRight: 8 }}>{form?.noMortgage ? 'Paid Off' : 'No Mortgage'}</span>
                <Switch
                  checked={!!form?.noMortgage}
                  onChange={e => setForm((f: any) => ({ ...f, noMortgage: e.target.checked }))}
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

            {/* Mortgage Fields - changes based on noMortgage state */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: form?.noMortgage ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)' }, gap: 2, alignItems: 'flex-start' }}>
              {form?.noMortgage ? (
                // When Paid Off (noMortgage = true): Show simple 3-column grid
                <>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Date You Paid House Off"
                      disableFuture
                      minDate={form?.date && isValidDateFns(parseDateFns(form.date, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.date, 'MM/dd/yyyy', new Date())
                        : undefined}
                      value={form?.mortgagePaidOffDate && isValidDateFns(parseDateFns(form.mortgagePaidOffDate, 'MM/dd/yyyy', new Date()))
                        ? parseDateFns(form.mortgagePaidOffDate, 'MM/dd/yyyy', new Date())
                        : null}
                      onChange={date => {
                        let purchaseDate = form?.date && isValidDateFns(parseDateFns(form.date, 'MM/dd/yyyy', new Date()))
                          ? parseDateFns(form.date, 'MM/dd/yyyy', new Date())
                          : null;
                        let newDate = '';
                        if (date instanceof Date && isValidDateFns(date)) {
                          if (purchaseDate && date < purchaseDate) {
                            newDate = formatDateFns(purchaseDate, 'MM/dd/yyyy');
                          } else {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            if (date > today) {
                              date = today;
                            }
                            newDate = formatDateFns(date, 'MM/dd/yyyy');
                          }
                        }
                        setForm((f: any) => ({ ...f, mortgagePaidOffDate: newDate }));
                      }}
                      slotProps={{ textField: { fullWidth: true, sx: { bgcolor: '#fff', fontFamily: 'Nunito, Arial, sans-serif' } } }}
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
                      if (parts.length > 2) return;
                      if (parts[0].length > 5) return;
                      if (parts[1] && parts[1].length > 2) return;
                      const asNumber = parseFloat(input);
                      if (!isNaN(asNumber) && asNumber > 99999.99) return;
                      setForm((f: any) => ({ ...f, hoa: input }));
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
                      setForm((f: any) => ({ ...f, yearly: newValue || '' }));
                    }}
                    fullWidth
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="HOA Payment" 
                        inputProps={{ ...params.inputProps, readOnly: true }}
                      />
                    )}
                  />
                  {/* Property Tax section inside noMortgage=true */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, gridColumn: '1 / -1' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                          label="Property Tax Due Date"
                          value={editingTaxDate || ((() => {
                            const taxHistory = property?.propertyTaxHistory || [];
                            if (taxHistory.length === 0) return null;
                            const sortedTaxes = [...taxHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                                newDate = today;
                              } else {
                                newDate = date;
                              }
                            }
                            setEditingTaxDate(newDate);
                            setTaxDateError('');
                            if (newDate) {
                              const selectedYear = new Date(newDate).getFullYear();
                              const taxHistory = property?.propertyTaxHistory || [];
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
                  {/* Insurance section inside noMortgage=true */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, gridColumn: '1 / -1', alignItems: 'flex-start' }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Insurance Due Date"
                        value={form?.insurance?.dueDate && isValidDateFns(parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                          ? parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date())
                          : null}
                        onChange={date => {
                          if (date instanceof Date && isValidDateFns(date)) {
                            const formatted = formatDateFns(date, 'MM/dd/yyyy');
                            setForm((f: any) => f ? { 
                              ...f, 
                              insurance: { 
                                insuranceCompany: f.insurance?.insuranceCompany || '',
                                assetsCovered: f.insurance?.assetsCovered || '',
                                policyNumber: f.insurance?.policyNumber || '',
                                amount: f.insurance?.amount || '',
                                frequency: f.insurance?.frequency || '',
                                dueDate: formatted 
                              } 
                            } : f);
                          } else {
                            setForm((f: any) => f ? { 
                              ...f, 
                              insurance: { 
                                insuranceCompany: f.insurance?.insuranceCompany || '',
                                assetsCovered: f.insurance?.assetsCovered || '',
                                policyNumber: f.insurance?.policyNumber || '',
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
                        setForm((f: any) => f ? { 
                          ...f, 
                          insurance: { 
                            insuranceCompany: f.insurance?.insuranceCompany || '',
                            assetsCovered: f.insurance?.assetsCovered || '',
                            policyNumber: f.insurance?.policyNumber || '',
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
                        setForm((f: any) => f ? { 
                          ...f, 
                          insurance: { 
                            insuranceCompany: f.insurance?.insuranceCompany || '',
                            assetsCovered: f.insurance?.assetsCovered || '',
                            policyNumber: f.insurance?.policyNumber || '',
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
                        setForm((f: any) => f ? { 
                          ...f, 
                          insurance: { 
                            insuranceCompany: f.insurance?.insuranceCompany || '',
                            assetsCovered: f.insurance?.assetsCovered || '',
                            policyNumber: f.insurance?.policyNumber || '',
                            dueDate: f.insurance?.dueDate || '',
                            amount: f.insurance?.amount || '',
                            frequency: newValue || '' 
                          } 
                        } : f);
                      }}
                      fullWidth
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="Insurance Payment" 
                          inputProps={{ ...params.inputProps, readOnly: true }}
                        />
                      )}
                    />
                  </Box>
                </>
              ) : (
                // When No Mortgage is OFF - show full mortgage fields
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
                      if (raw) {
                        if (rateNum < 0.01 || rateNum > 99.99) return;
                      }
                      setForm((f: any) => ({ ...f, interestRate: raw }));
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
                      let input = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      if (parts.length > 2) return;
                      if (parts[0].length > 8) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setForm((f: any) => ({ ...f, balance: input }));
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
                      let input = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = input.split('.');
                      if (parts.length > 2) return;
                      if (parts[1] && parts[1].length > 2) return;
                      setForm((f: any) => ({ ...f, estimatedValue: input }));
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
                      if (parts.length > 2) return;
                      if (parts[0].length > 4) return;
                      if (parts[1] && parts[1].length > 2) return;
                      const asNumber = parseFloat(input);
                      if (!isNaN(asNumber) && asNumber > 9999.99) return;
                      setForm((f: any) => ({ ...f, pmi: input }));
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
                        setForm((f: any) => ({ ...f, term: newValue || '' }));
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
                      onChange={e => setForm((f: any) => ({ ...f, lender: e.target.value }))}
                      inputProps={{ maxLength: 15 }}
                    />
                    <TextField
                      label="Mortgage Payment"
                      placeholder="Optional"
                      fullWidth
                      value={form?.mortgagePaymentAmount || ''}
                      onChange={e => {
                        let input = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = input.split('.');
                        if (parts.length > 2) return;
                        if (parts[0].length > 5) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setForm((f: any) => ({ ...f, mortgagePaymentAmount: input }));
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      inputProps={{ inputMode: 'decimal', maxLength: 8 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 550, color: '#343748', marginRight: 8 }}>Escrow Account</span>
                      <Switch
                        checked={form?.isPT || false}
                        onChange={e => setForm((f: any) => ({ ...f, isPT: e.target.checked }))}
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
                  <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="HOA Dues"
                      placeholder="Optional"
                      fullWidth
                      value={form?.hoa || ''}
                      onChange={e => {
                        let input = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = input.split('.');
                        if (parts.length > 2) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setForm((f: any) => ({ ...f, hoa: input }));
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      inputProps={{ inputMode: 'decimal', maxLength: 9 }}
                    />
                    <Autocomplete
                      options={['Monthly', 'Yearly']}
                      value={form?.yearly || ''}
                      onChange={(_event, newValue) => {
                        setForm((f: any) => ({ ...f, yearly: newValue || '' }));
                      }}
                      fullWidth
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="HOA Payment" 
                          inputProps={{ ...params.inputProps, readOnly: true }}
                        />
                      )}
                    />
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}

        {/* Property Tax and Insurance Sections - shown when has mortgage but no escrow - OWNER ONLY */}
        {role === 'owner' && !form?.noMortgage && !form?.isPT && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, gridColumn: '1 / -1', mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Property Tax Due Date"
                    value={editingTaxDate || ((() => {
                    const taxHistory = property?.propertyTaxHistory || [];
                    if (taxHistory.length === 0) return null;
                    const sortedTaxes = [...taxHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                          newDate = today;
                        } else {
                          newDate = date;
                        }
                      }
                      setEditingTaxDate(newDate);
                      setTaxDateError('');
                      if (newDate) {
                        const selectedYear = new Date(newDate).getFullYear();
                        const taxHistory = property?.propertyTaxHistory || [];
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
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, gridColumn: '1 / -1', mt: 2, alignItems: 'flex-start' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Insurance Due Date"
                  value={form?.insurance?.dueDate && isValidDateFns(parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date()))
                    ? parseDateFns(form.insurance.dueDate, 'MM/dd/yyyy', new Date())
                    : null}
                  onChange={date => {
                    if (date instanceof Date && isValidDateFns(date)) {
                      const formatted = formatDateFns(date, 'MM/dd/yyyy');
                      setForm((f: any) => f ? { 
                        ...f, 
                        insurance: { 
                          insuranceCompany: f.insurance?.insuranceCompany || '',
                          assetsCovered: f.insurance?.assetsCovered || '',
                          policyNumber: f.insurance?.policyNumber || '',
                          amount: f.insurance?.amount || '',
                          frequency: f.insurance?.frequency || '',
                          dueDate: formatted 
                        } 
                      } : f);
                    } else {
                      setForm((f: any) => f ? { 
                        ...f, 
                        insurance: { 
                          insuranceCompany: f.insurance?.insuranceCompany || '',
                          assetsCovered: f.insurance?.assetsCovered || '',
                          policyNumber: f.insurance?.policyNumber || '',
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
                  setForm((f: any) => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
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
                  setForm((f: any) => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
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
                  setForm((f: any) => f ? { 
                    ...f, 
                    insurance: { 
                      insuranceCompany: f.insurance?.insuranceCompany || '',
                      assetsCovered: f.insurance?.assetsCovered || '',
                      policyNumber: f.insurance?.policyNumber || '',
                      dueDate: f.insurance?.dueDate || '',
                      amount: f.insurance?.amount || '',
                      frequency: newValue || '' 
                    } 
                  } : f);
                }}
                fullWidth
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Insurance Payment" 
                    inputProps={{ ...params.inputProps, readOnly: true }}
                  />
                )}
              />
            </Box>
          </>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, mb: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              if (onDelete && mode !== 'add') {
                setShowFirstDeleteConfirm(true);
              } else {
                handleClose();
              }
            }}
            sx={{
              bgcolor: onDelete && mode !== 'add' ? '#fff' : '#f5f5f5',
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
              cursor: onDelete && mode !== 'add' ? 'pointer' : 'default',
              '&:hover': onDelete && mode !== 'add' ? { bgcolor: '#E57373', color: '#fff', borderColor: '#d32f2f' } : { bgcolor: '#f5f5f5', borderColor: '#666' },
            }}
          >
            {onDelete && mode !== 'add' ? 'Delete' : 'Cancel'}
          </Button>

          {/* Shared backdrop for delete modals */}
          {(showFirstDeleteConfirm || showSecondDeleteConfirm) && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1299,
              }}
              onClick={() => {
                setShowFirstDeleteConfirm(false);
                setShowSecondDeleteConfirm(false);
              }}
            />
          )}

          {/* First Delete Confirmation Modal */}
          <Dialog
            open={showFirstDeleteConfirm}
            onClose={() => setShowFirstDeleteConfirm(false)}
            hideBackdrop
            PaperProps={{
              sx: {
                borderRadius: '16px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
                minWidth: 500,
                maxWidth: 640,
                width: '100%',
                p: 0,
                bgcolor: '#fff',
              }
            }}
          >
            <DialogTitle
              sx={{
                fontWeight: 550,
                fontSize: 18,
                color: '#343748',
                px: 3,
                pt: 3,
                pb: 1.5,
                fontFamily: 'Nunito, Arial, sans-serif',
                background: 'transparent',
              }}
            >
              Remove Property
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
              <Box
                sx={{
                  bgcolor: '#F9B55D',
                  color: '#343748',
                  borderRadius: '8px',
                  p: '12px 20px',
                  mb: 4,
                  fontWeight: 400,
                  fontSize: 17,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  letterSpacing: 0,
                  lineHeight: 1.3,
                  boxSizing: 'border-box',
                }}
              >
                You are about to remove this property permanently. Are you sure you want to continue?
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  onClick={() => { setShowFirstDeleteConfirm(false); setShowSecondDeleteConfirm(true); }}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#E57373',
                    color: '#fff',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    boxShadow: 'none',
                    textTransform: 'none',
                    mr: 2,
                    '&:hover': {
                      bgcolor: '#d32f2f',
                    },
                  }}
                >
                  Delete
                </Button>
                <Button
                  onClick={() => setShowFirstDeleteConfirm(false)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#fff',
                    color: '#343748',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    border: '1.5px solid #D9D9D9',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      borderColor: '#B0B8C1',
                    },
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          {/* Second Delete Confirmation Modal */}
          <Dialog
            open={showSecondDeleteConfirm}
            onClose={() => setShowSecondDeleteConfirm(false)}
            hideBackdrop
            PaperProps={{
              sx: {
                borderRadius: '16px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
                minWidth: 500,
                maxWidth: 640,
                width: '100%',
                p: 0,
                bgcolor: '#fff',
              }
            }}
          >
            <DialogTitle
              sx={{
                fontWeight: 550,
                fontSize: 18,
                color: '#343748',
                px: 3,
                pt: 3,
                pb: 1.5,
                fontFamily: 'Nunito, Arial, sans-serif',
                background: 'transparent',
              }}
            >
              Remove Property
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
              <Box
                sx={{
                  bgcolor: '#F9B55D',
                  color: '#343748',
                  borderRadius: '8px',
                  p: '12px 20px',
                  mb: 4,
                  fontWeight: 400,
                  fontSize: 17,
                  fontFamily: 'Nunito, Arial, sans-serif',
                  letterSpacing: 0,
                  lineHeight: 1.3,
                  boxSizing: 'border-box',
                }}
              >
                Are you sure you want to remove this property? This CANNOT be undone.
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  onClick={() => setShowSecondDeleteConfirm(false)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#fff',
                    color: '#343748',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    border: '1.5px solid #D9D9D9',
                    boxShadow: 'none',
                    textTransform: 'none',
                    mr: 2,
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      borderColor: '#B0B8C1',
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 120,
                    height: 44,
                    bgcolor: '#E57373',
                    color: '#fff',
                    fontWeight: 400,
                    fontSize: 16,
                    fontFamily: 'Nunito, Arial, sans-serif',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: '#d32f2f',
                    },
                  }}
                >
                  {deleteLoading ? 'Removing...' : 'Remove'}
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Share with Owner button: show for PM or Family Member (not Co-Owner), disable if property has owner */}
            {(() => {
              const auth = getAuth();
              const user = auth.currentUser;
              const userId = user?.uid;
              const isPM = role === 'pm';
              // Family member: sharedWith entry with role 'Family', 'Family Member', or 'Family Manager' and userId matches
              const isFamilyMember = Array.isArray(property?.sharedWith) && property.sharedWith.some((sw: any) => sw?.userId === userId && (
                sw?.role === 'Family' || sw?.role === 'Family Member' || sw?.role === 'Family Manager')
              );
              const hasOwner = !!property?.ownerId && property.ownerId !== '';
              if ((isPM || isFamilyMember) && mode !== 'add') {
                return (
                  <Button
                    variant="contained"
                    onClick={() => setShowShareModal(true)}
                    disabled={hasOwner}
                    sx={{
                      bgcolor: hasOwner ? '#f5f5f5' : '#fff',
                      color: hasOwner ? '#b0b0b0' : '#555',
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      minWidth: 120,
                      fontSize: 16,
                      border: hasOwner ? '1.5px solid #ddd' : '1.5px solid #888',
                      fontFamily: 'Nunito, Arial, sans-serif',
                      boxShadow: 'none',
                      textTransform: 'none',
                      cursor: hasOwner ? 'not-allowed' : 'pointer',
                      opacity: hasOwner ? 1 : undefined,
                      '&:hover': hasOwner
                        ? { bgcolor: '#f5f5f5', borderColor: '#ddd' }
                        : { bgcolor: '#f5f5f5', borderColor: '#666' },
                    }}
                  >
                    Share with Owner
                  </Button>
                );
              }
              return null;
            })()}
            <Button
              variant="contained"
              disabled={saving}
              onClick={handleSave}
              sx={{
                fontWeight: 400,
                fontSize: 16,
                fontFamily: 'Nunito, Arial, sans-serif',
                textTransform: 'none',
                bgcolor: '#89AE99',
                color: '#fff',
                px: 4,
                py: 1.5,
                borderRadius: 2,
                minWidth: 120,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#7a9e8a' },
              }}
            >
              {saving ? (mode === 'add' ? 'Saving...' : 'Updating...') : (mode === 'add' ? 'Save' : 'Update')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>

    {/* Share with Owner Modal */}
    <Dialog
      open={showShareModal}
      onClose={() => {
        setShowShareModal(false);
        setShareEmail('');
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ fontSize: 24, fontWeight: 500, fontFamily: 'Nunito, Arial, sans-serif', pb: 2 }}>
        Share with Owner
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth
            placeholder="Email Address"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'Nunito, Arial, sans-serif',
                fontSize: 16,
              },
              '& .MuiOutlinedInput-input::placeholder': {
                opacity: 0.6,
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
            <Button
              onClick={() => {
                setShowShareModal(false);
                setShareEmail('');
              }}
              sx={{
                bgcolor: '#fff',
                color: '#555',
                px: 3,
                py: 1,
                borderRadius: 2,
                border: '1.5px solid #888',
                fontFamily: 'Nunito, Arial, sans-serif',
                textTransform: 'none',
                fontSize: 14,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#f5f5f5', borderColor: '#666' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!shareEmail.trim()) {
                  alert('Please enter an email address');
                  return;
                }
                // TODO: Implement share functionality
                console.log('Share with owner:', shareEmail);
                setShowShareModal(false);
                setShareEmail('');
              }}
              sx={{
                bgcolor: '#8CB19C',
                color: '#fff',
                px: 3,
                py: 1,
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                textTransform: 'none',
                fontSize: 14,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#7a9e8a' },
              }}
            >
              Share
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  </>
  );
};

export default EditPropertyModal;
