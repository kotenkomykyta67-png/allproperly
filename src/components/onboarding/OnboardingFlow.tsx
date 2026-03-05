import React, { useState } from 'react';
import FAQModal from './FAQModal';
import { getNextUniqueTasks } from '../../utils/taskRecurringHelpers';
import { doc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import OnboardingSidebar from './OnboardingSidebar';
import Welcome from './Welcome';
import AddPropertyStep from './AddPropertyStep';
import PurchasePriceStep from './PurchasePriceStep';
import MortgageInfoStep from './MortgageInfoStep';
import PropertyInventoryStep from './PropertyInventoryStep';
import type { StructuredAddress } from './AddressAutocomplete';
import buildPropertyModel from '../../utils/buildPropertyModel';
import Dashboard from '../../pages/Dashboard';

export interface OnboardingData {
  property?: {
    address?: StructuredAddress;
    type?: string;
  };
  purchasePrice?: {
    price?: number;
    date?: string;
  };
  mortgage?: {
    interestRate?: string;
    balance?: string;
    lender?: string;
  };
  estimatedValue?: number;
  inventory?: string[];
}

interface OnboardingFlowProps {
  onFinish?: () => void;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onFinish }) => {
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));
  const [faqOpen, setFaqOpen] = useState(false);
  const handleFaqOpen = () => setFaqOpen(true);
  const handleFaqClose = () => setFaqOpen(false);
  const handleChange = (updates: Partial<OnboardingData>) => {
    // If address is updated
    if (updates.property?.address) {
      const addr = updates.property.address;
      // Always preserve previous property name (type) unless explicitly set
      const getMergedProperty = (prev: OnboardingData) => ({
        ...updates.property,
        type: updates.property?.type !== undefined ? updates.property.type : prev.property?.type || ""
      });
      // If address is complete, fetch ATTOM API
      if (addr.street && addr.city && addr.state && addr.zip) {
        fetch("https://getattompropertydetailshttp-kgqlakneiq-uc.a.run.app/getAttomPropertyDetails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: addr.street,
            city: addr.city,
            state: addr.state,
            zip: addr.zip
          })
        })
          .then(res => {
            if (!res.ok) throw new Error("Failed to fetch property details");
            return res.json();
          })
          .then(result => {
            setAttomData(result);
            // Prefill purchase price, date, balance, interest, lender
            setData(prev => ({
              ...prev,
              property: getMergedProperty(prev),
              purchasePrice: {
                price: typeof result.sale?.saleAmountData?.saleAmt === 'number' ? result.sale.saleAmountData.saleAmt : 0,
                date: result.sale?.saleTransDate || ''
              },
              mortgage: {
                interestRate: '', // ATTOM rarely provides interest
                balance: result.assessment?.mortgage?.FirstConcurrent?.amount?.toString() || '',
                lender: result.assessment?.mortgage?.FirstConcurrent?.lenderLastName || ''
              },
              estimatedValue: result.assessment?.assessed?.assdTtlValue ? result?.assessment?.assessed?.assdTtlValue : null,
            }));
          })
          .catch(() => {
            setAttomData(null);
            // Clear prefilled fields if ATTOM fails
            setData(prev => ({
              ...prev,
              property: getMergedProperty(prev),
              purchasePrice: { price: 0, date: '' },
              mortgage: { interestRate: '', balance: '', lender: '' },
              estimatedValue: 0,
            }));
          });
        return;
      } else {
        // Address is incomplete, clear ATTOM data and prefilled fields
        setAttomData(null);
        setData(prev => ({
          ...prev,
          property: getMergedProperty(prev),
          purchasePrice: { price: 0, date: '' },
          mortgage: { interestRate: '', balance: '', lender: '' },
          estimatedValue: 0,
        }));
        return;
      }
    }
    setData((prev) => ({ ...prev, ...updates }));
  };
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [attomData, setAttomData] = useState<any>(null);

  const totalSteps = 5;


  const nextStep = async () => {
    if (currentStep === totalSteps) {
      // Build property model from onboarding data
      const ownerId = auth.currentUser?.uid || '';
      // Map onboarding data to form/attomData structure expected by buildPropertyModel
      const form = {
        propertyName: data.property?.type || '',
        address1: data.property?.address?.street || '',
        city: data.property?.address?.city || '',
        state: data.property?.address?.state || '',
        zip: data.property?.address?.zip || '',
        country: data.property?.address?.country || '',
        price: data.purchasePrice?.price?.toString() || '',
        date: data.purchasePrice?.date || '',
        interestRate: data.mortgage?.interestRate ?? '',
        balance: data.mortgage?.balance || '',
        lender: data.mortgage?.lender || '',
        yearBuilt: '',
        squareFeet: '',
        bedrooms: '',
        bathrooms: '',
        lotSize: '',
        estimatedValue: data.estimatedValue ?? '',
        inventory: data.inventory || []
      };
      const propertyModel = buildPropertyModel({ form, attomData, ownerId });
      console.log('Final Property Model (Onboarding):', propertyModel);
      setIsLoading(true);
      // Save property to Firestore
      if (ownerId) {
        const { collection, addDoc } = await import('firebase/firestore');
        let newPropertyId = '';
        try {
          const docRef = await addDoc(collection(db, 'properties'), propertyModel);
          newPropertyId = docRef.id;
          // --- BEGIN: Task Creation ---
          const taskTemplates = (await import('../../context/task.json')).default;
          const today = new Date();
          // Add default tasks (inventory is empty)
          const defaultTasks = taskTemplates.filter(t => !t.inventory || t.inventory === "");
          // Add inventory-related tasks for checked items
          const inventoryList = propertyModel.inventory || [];
          const inventoryTasks = taskTemplates.filter(t => t.inventory && inventoryList.includes(t.inventory));
          // Combine all
          const allTasks = [...defaultTasks, ...inventoryTasks];
          // For each unique task (by title+type), only add the next instance after today
          const nextTasks = getNextUniqueTasks(allTasks, today);
          await Promise.all(nextTasks.map(template => {
            const newTask = {
              title: template.title,
              description: template.description,
              type: template.type,
              startDate: template.startDate,
              dueDate: template.dueDate,
              recurrency: {
                frequency: template.frequency || 'None',
                interval: template.interval || 1,
              },
              propertyId: newPropertyId,
              ownerId: ownerId,
              status: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              assigned_user: null,
              completedBy: '',
              inventory: template.inventory
            };
            return addDoc(collection(db, "tasks"), newTask);
          }));
          // --- END: Task Creation ---
        } catch (e) {
          console.error('Error saving property or tasks:', e);
        }
        // Mark onboarding as complete in Firestore
        const userRef = doc(db, 'users', ownerId);
        const { setDoc } = await import('firebase/firestore');
        await setDoc(userRef, { hasCompletedOnboarding: true }, { merge: true });
      }
      if (typeof onFinish === "function") {
        onFinish();
      }
      setCurrentStep(0);
    } else {
      setCurrentStep((s) => Math.min(s + 1, totalSteps));
    }
  };
    if (isLoading) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#F9F9F9',
          fontFamily: 'Nunito, Arial, sans-serif',
          zIndex: 9999
        }}>
          <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', top: 0, left: 0, animation: 'spinRotate 3s linear infinite' }}>
              <circle
                cx="70"
                cy="70"
                r="60"
                strokeWidth="11"
                fill="none"
                strokeLinecap="round"
                style={{
                  transformOrigin: 'center',
                  animation: 'spinDash 2.5s ease-in-out infinite, spinColor 5s ease-in-out infinite'
                }}
              />
              <style>{`
                @keyframes spinRotate {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes spinDash {
                  0% {
                    stroke-dasharray: 1, 377;
                    stroke-dashoffset: 0;
                  }
                  50% {
                    stroke-dasharray: 300, 377;
                    stroke-dashoffset: -75;
                  }
                  100% {
                    stroke-dasharray: 1, 377;
                    stroke-dashoffset: -377;
                  }
                }
                @keyframes spinColor {
                  0%, 49% {
                    stroke: #89AE99;
                  }
                  50%, 99% {
                    stroke: #6A7F91;
                  }
                  100% {
                    stroke: #89AE99;
                  }
                }
              `}</style>
            </svg>
          </div>
          <div style={{ position: 'absolute', bottom: '35%', color: '#333', fontWeight: 550, fontSize: 22 }}>Setting up your Account...</div>
        </div>
      );
    }

    if (currentStep === 0) {
      sessionStorage.clear();
      localStorage.clear();
      return <Dashboard defaultPage='property' />;
    }

    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div style={{ width: '30vw' }}>
          <OnboardingSidebar currentStep={currentStep} totalSteps={totalSteps} onFaqClick={handleFaqOpen} />
        </div>

        <div style={{ width: '70vw'}}>
          {currentStep === 1 && <Welcome onNext={nextStep} />}
          {currentStep === 2 && (
            <AddPropertyStep
              data={data.property}
              onChange={(property) => handleChange({ property })}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
            <PurchasePriceStep
              data={data.purchasePrice}
              onChange={(purchasePrice) => handleChange({ purchasePrice: purchasePrice })}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 4 && (
            <MortgageInfoStep
              data={data.mortgage}
              onChange={(mortgage) => handleChange({ mortgage: mortgage })}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 5 && (
            <PropertyInventoryStep
              data={data.inventory}
              onChange={(inventory) => handleChange({ inventory })}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
        </div>
        {/* FAQ Modal */}
        <FAQModal open={faqOpen} onClose={handleFaqClose} />
      </div>
    );
  }
  
  export default OnboardingFlow;
