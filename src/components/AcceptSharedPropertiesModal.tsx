import { useState } from "react";
import { auth } from "../services/firebase";
import { getSharedPropertyCountForUser } from "../services/PropertyService";
import UpgradeLimitModal from "./UpgradeLimitModal";
import { useEffect } from "react";
import { Box, Typography, Button, Dialog, TextField } from "@mui/material";
import './AcceptSharedPropertiesModal.css';

interface Property {
  id: string;
  name: string;
  inviter: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  photoUrl?: string;
  selected?: boolean;
  label?: string;
}

interface AcceptSharedPropertiesModalProps {
  open: boolean;
  properties: Property[];
  onSave: (selected: Array<{ id: string; label: string }>) => void;
  onClose: () => void;
  planState: string;
  onShowUpgrade?: () => void;
}

export default function AcceptSharedPropertiesModal({ open, properties, onSave, onClose, planState, onShowUpgrade }: AcceptSharedPropertiesModalProps) {
  const [propertyStates, setPropertyStates] = useState(
    properties.map(p => ({ ...p, selected: true, label: p.name }))
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currentSharedCount, setCurrentSharedCount] = useState<number>(0);

  useEffect(() => {
    if (open) setShowUpgradeModal(false);
    // Fetch current user's shared property count by checking sharedWith array in properties
    const fetchSharedCount = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const count = await getSharedPropertyCountForUser(uid);
      setCurrentSharedCount(count);
    };
    if (open) fetchSharedCount();
  }, [open]);

  const handleToggle = (idx: number) => {
    setPropertyStates(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  };

  const handleLabelChange = (idx: number, value: string) => {
    setPropertyStates(prev => prev.map((p, i) => i === idx ? { ...p, label: value } : p));
  };

  // Get plan limit from planState
  const getPlanLimit = (plan: string) => {
    if (plan === "free") return 1;
    if (plan === "basic" || plan === "basic_annual") return 5;
    if (plan === "plus" || plan === "plus_annual") return 10;
    return 1;
  };

  const handleSave = () => {
    const selected = propertyStates.filter(p => p.selected).map(p => ({ id: p.id, label: p.label || p.name }));
    const selectedCount = selected.length;
    const planLimit = getPlanLimit(planState);
    
    // Special users bypass plan limit check
    const specialUsers = ['andrii@allproperly.com', 'river@fishdawgproductions.com'];
    const currentUserEmail = auth.currentUser?.email || '';
    const isSpecialUser = specialUsers.includes(currentUserEmail);
    
    if (!isSpecialUser && currentSharedCount + selectedCount > planLimit) {
      setShowUpgradeModal(true);
      return;
    }
    onSave(selected);
  };

  return (
    <>
      <Dialog open={open} maxWidth={false} fullWidth PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(137,174,153,0.18)',
          background: '#F8F9FB',
          minWidth: 600,
          maxWidth: 800,
          mx: 'auto',
          p: 0,
        }
      }}>
        <Box sx={{
          p: 4,
          borderRadius: 2,
          background: '#F8F9FB',
        }}>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, color: '#2D3748', fontSize: 16, letterSpacing: 0.2, mb: 2.5 }}>Property Shared</Typography>
          <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', mb: 4, color: '#222', fontSize: 17, fontWeight: 400 }}>
            These properties were shared with you. Would you like to give it your own label?{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 200, fontFamily: 'Nunito, Arial, sans-serif' }}>Turn the toggle off next to any property you don’t want to include.</span>
          </Typography>
          {propertyStates.map((p, idx) => {
            return (
              <Box key={p.id} sx={{
                display: 'flex', alignItems: 'center',
                background: p.selected ? '#F6F8F7' : 'transparent',
                borderRadius: 2,
                px: 2,
                py: 1.5,
                boxShadow: p.selected ? '0 2px 12px rgba(137,174,153,0.10)' : 'none',
                transition: 'background 0.2s',
                minHeight: 70,
              }}>
                <label className="figma-toggle" style={{marginRight: 16}}>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={() => handleToggle(idx)}
                  />
                  <span className="figma-slider" />
                </label>
                <img
                  src={p.photoUrl || "/empty-property.png"}
                  alt={p.name || "Property"}
                  style={{
                    width: 60,
                    height: 60,
                    marginRight: 12,
                    objectFit: "cover",
                    borderRadius: "50%",
                    background: "#eee",
                    border: "2px solid #fff",
                    boxShadow: "0 2px 8px rgba(137,174,153,0.10)"
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography sx={{ fontWeight: 550, fontSize: 16, color: '#121212', mb: 0.2 }}>{p.name}</Typography>
                  {(p.address1 || p.city || p.state || p.zip) && (
                    <Typography sx={{ fontWeight: 400, fontSize: 16, color: '#121212', mb: 0.2, lineHeight: 1.2 }}>
                      {p.address1 ? p.address1 : ''}
                      {(p.city || p.state || p.zip) ? <><br /></> : null}
                      {[p.city, p.state, p.zip].filter(Boolean).join(', ')}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'Nunito, Arial, sans-serif', color: '#1F1F1F', fontSize: 16, fontWeight: 200, mr: 1 }}>Share by:</Typography>
                    <Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 200, fontSize: 16, color: '#1F1F1F', lineHeight: 1 }}>{p.inviter}</Typography>
                  </Box>
                </Box>
                <TextField
                  value={p.label || ""}
                  onChange={e => {
                    const val = e.target.value.slice(0, 15);
                    handleLabelChange(idx, val);
                  }}
                  placeholder="Rename"
                  inputProps={{ maxLength: 15 }}
                  sx={{
                    width: 320,
                    bgcolor: '#F7F7F7',
                    borderRadius: 2,
                    '& .MuiOutlinedInput-root': {
                      fontSize: 15,
                      color: '#222',
                      borderRadius: 2,
                      background: '#F7F7F7',
                      '& fieldset': { borderColor: '#E0E0E0' },
                      '&:hover fieldset': { borderColor: '#89AE99' },
                      '&.Mui-focused fieldset': { borderColor: '#89AE99' },
                    },
                    '& input': {
                      fontWeight: 400,
                      color: '#6D6D6D',
                    },
                  }}
                />
              </Box>
            );
          })}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
            <Button
              variant="outlined"
              sx={{
                color: '#6D6D6D',
                borderColor: '#E0E0E0',
                fontWeight: 400,
                borderRadius: 2,
                px: 3,
                fontFamily: 'Nunito, Arial, sans-serif',
                textTransform: 'none',
                py: 1.5,
                fontSize: 16,
                background: '#fff',
                '&:hover': { borderColor: '#89AE99', background: '#F6F8F7' },
              }}
              onClick={async () => {
                // Delete invite document from Firestore
                try {
                  const urlParams = new URLSearchParams(window.location.search);
                  const inviteId = urlParams.get("inviteId");
                  if (inviteId) {
                    const { getFirestore, doc, deleteDoc } = await import("firebase/firestore");
                    const db = getFirestore();
                    await deleteDoc(doc(db, "invites", inviteId));
                  }
                } catch (err) {
                  // Optionally log error, but still close modal
                  console.error("Failed to delete invite document", err);
                }
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{
                background: '#89AE99',
                color: '#fff',
                fontWeight: 400,
                borderRadius: 2,
                fontFamily: 'Nunito, Arial, sans-serif',
                textTransform: 'none',
                px: 4,
                py: 0.5,
                fontSize: 16,
                boxShadow: '0 2px 8px rgba(137,174,153,0.10)',
              }}
              onClick={handleSave}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Dialog>
      {showUpgradeModal && (
        <UpgradeLimitModal
          open={showUpgradeModal}
          onCancel={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            // Get inviteId from URL
            const urlParams = new URLSearchParams(window.location.search);
            const inviteId = urlParams.get("inviteId");
            // Store pending shared properties and inviteId in sessionStorage
            const selected = propertyStates.filter(p => p.selected).map(p => ({ id: p.id, label: p.label || p.name }));
            sessionStorage.setItem("pendingSharedProperties", JSON.stringify({ flag: true, properties: selected, inviteId }));
            setShowUpgradeModal(false);
            if (onShowUpgrade) onShowUpgrade();
            // Remove inviteId from URL
            if (inviteId) {
              const url = new URL(window.location.href);
              url.searchParams.delete("inviteId");
              window.history.replaceState({}, document.title, url.toString());
            }
            onClose();
          }}
          planState={planState}
        />
      )}
    </>
  );
}
