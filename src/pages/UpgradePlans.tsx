import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal, Switch, Avatar, Divider } from "@mui/material";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import { getAuth } from "firebase/auth";
import { getUserProfile } from "../services/UserService";
import { getAllPropertiesForUser } from "../services/PropertyService";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { db } from "../services/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

type PlanFeature = { text: string; checked: boolean; bold?: boolean };
type Plan = {
	name: string;
	price: string;
	subtext: string;
	features: PlanFeature[];
};
type PlanData = {
	monthly: Plan[];
	annually: Plan[];
};

const planData: PlanData = {
	monthly: [
		{
			name: "Free",
			price: "",
			subtext: "",
			features: [
				{ text: "Add 1 property", checked: true },
				{ text: "View the property details", checked: true },
				{ text: "Access auto-generated & shared tasks", checked: true },
				{ text: "Task creation or sharing", checked: false },
			],
		},
		{
			name: "Basic",
			price: "$15 / mo",
			subtext: "",
			features: [
				{ text: "Manage up to 5 properties", checked: true, bold: true },
				{ text: "Create & edit tasks", checked: true },
				{ text: "Task history + health barometer", checked: true },
				{ text: "Weather & seasonal reminders", checked: true },
				{ text: "Share & invite family or managers", checked: true },
			],
		},
		{
			name: "Plus",
			price: "$30 / mo",
			subtext: "",
			features: [
				{ text: "Manage up to 10 properties", checked: true, bold: true },
				{ text: "Everything in Basic Plan", checked: true },
				{ text: "More space for growing portfolios", checked: true },
			],
		},
	],
	annually: [
		{
			name: "Free",
			price: "",
			subtext: "",
			features: [
				{ text: "Add 1 property", checked: true },
				{ text: "View the property details", checked: true },
				{ text: "Access auto-generated & shared tasks", checked: true },
				{ text: "Task creation or sharing", checked: false },
			],
		},
		{
			name: "Basic",
			price: "$100 / year",
			subtext: "just $8.33/mo - save 45%",
			features: [
				{ text: "Manage up to 5 properties", checked: true, bold: true },
				{ text: "Create & edit tasks", checked: true },
				{ text: "Task history + health barometer", checked: true },
				{ text: "Weather & seasonal reminders", checked: true },
				{ text: "Share & invite family or managers", checked: true },
			],
		},
		{
			name: "Plus",
			price: "$200 / year",
			subtext: "just $16.67/mo - save 45%",
			features: [
				{ text: "Manage up to 10 properties", checked: true, bold: true },
				{ text: "Everything in Basic Plan", checked: true },
				{ text: "More space for growing portfolios", checked: true },
			],
		},
	],
};

interface UpgradePlansProps {
	onBilling: () => void;
	sidebar?: boolean;
}

export default function UpgradePlans({ onBilling, sidebar }: UpgradePlansProps) {
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	const auth = getAuth();
	const user = auth.currentUser;
	
	const handleDeleteSubscription = async () => {
		setDeleteLoading(true);
		try {
			// TODO: Add delete subscription logic here
			async function deleteUserTasks() {
				if (!user?.uid) return;
				setDeleteLoading(true);
				const { db } = await import("../services/firebase");
				const { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayRemove } = await import("firebase/firestore");
				// Delete tasks
				const tasksRef = collection(db, "tasks");
				const tasksQ = query(tasksRef, where("ownerId", "==", user.uid));
				const tasksSnap = await getDocs(tasksQ);
				const deleteTaskPromises = tasksSnap.docs.map(taskDoc => deleteDoc(doc(db, "tasks", taskDoc.id)));
				await Promise.all(deleteTaskPromises);

				// Delete properties owned by user
				const propertiesRef = collection(db, "properties");
				const propsQ = query(propertiesRef, where("ownerId", "==", user.uid));
				const propsSnap = await getDocs(propsQ);
				const deletePropPromises = propsSnap.docs.map(propDoc => deleteDoc(doc(db, "properties", propDoc.id)));
				await Promise.all(deletePropPromises);

				// Remove user from sharedWith in all properties
				const allPropsSnap = await getDocs(propertiesRef);
				const updateSharedPromises = allPropsSnap.docs
					.filter(docSnap => Array.isArray(docSnap.data().sharedWith) && docSnap.data().sharedWith.includes(user.uid))
					.map(docSnap => updateDoc(doc(db, "properties", docSnap.id), { sharedWith: arrayRemove(user.uid) }));
				await Promise.all(updateSharedPromises);

				// Delete user document
				const userRef = doc(db, "users", user.uid);
				await deleteDoc(userRef);
				
				
				setDeleteLoading(false);
				setShowDeleteConfirmModal(false);
				setShowDeleteModal(false);
				// Sign out the user
				await auth.signOut();
			}
			deleteUserTasks();
		} catch (error) {
			console.error("Failed to delete subscription:", error);
		} finally {
			setDeleteLoading(false);
			setShowDeleteConfirmModal(false);
			setShowDeleteModal(false);
		}
	};

	const [billing, setBilling] = useState("monthly"); // default to monthly
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [planState, setPlanState] = useState<string>("");
	const [profileLoading, setProfileLoading] = useState(true);
	const [selectedPlan, setSelectedPlan] = useState<string>("");

	// Downgrade modal state
	const [showDowngradeModal, setShowDowngradeModal] = useState(false);
	const [downgradeInfo, setDowngradeInfo] = useState<any>(null);
	const [propertyToggles, setPropertyToggles] = useState<{[id: string]: boolean}>({});
	const [userProperties, setUserProperties] = useState<any[]>([]);
	const [propertiesLoading, setPropertiesLoading] = useState(false);
	const [showLimitErrorModal, setShowLimitErrorModal] = useState(false);
	const [limitErrorMsg, setLimitErrorMsg] = useState("");

	// Cancel subscription modal state
	const [showCancelModal, setShowCancelModal] = useState(false);
	const [cancelStep, setCancelStep] = useState(1);

	// Upgrade confirmation modal state
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);
	const [pendingUpgradePlan, setPendingUpgradePlan] = useState("");

	// Upgrade/Downgrade detection functions
	const getPlanHierarchy = (planName: string): number => {
		const hierarchyMap: { [key: string]: number } = {
			'free': 0,
			'basic': 1,
			'basic_annual': 3,
			'plus': 2,
			'plus_annual': 4
		};
		return hierarchyMap[planName.toLowerCase()] || 0;
	};

	const isUpgrade = (currentPlan: string, targetPlan: string): boolean => {
		return getPlanHierarchy(targetPlan) > getPlanHierarchy(currentPlan);
	};

	// Move fetchUserPlan outside useEffect for reuse
	async function fetchUserPlan(resultPlan?: string) {
		const auth = getAuth();
		console.log(resultPlan, "Updated plan as a result of payment");
		const user = auth.currentUser;
		if (user) {
			setProfileLoading(true);
			const profile = await getUserProfile(user.uid);
			console.log(user.uid, "Fetched profile");
			console.log(profile?.planState, "Updated plan as a result of payment");
			if(resultPlan === undefined) resultPlan = profile?.planState || "free";
			const normalizedPlan = resultPlan.toLowerCase() === undefined ? "free" : resultPlan.toLowerCase();
			setPlanState(normalizedPlan);
			// Set toggle state based on plan
			if (normalizedPlan === "basic_annual" || normalizedPlan === "plus_annual") {
				setBilling("annually");
			} else {
				setBilling("monthly");
			}
			setProfileLoading(false);
		} else {
			setPlanState("free");
			setBilling("monthly");
			setProfileLoading(false);
		}
	}
		useEffect(() => {
			// If returning from Stripe Checkout, poll for updated planState
			const params = new URLSearchParams(window.location.search);
			const checkoutResult = params.get("checkout");
			if (checkoutResult === "success") {
				let tries = 0;
				const pollForPlan = async () => {
					while (tries < 6) { // up to 12 seconds
						await fetchUserPlan();
						const auth = getAuth();
						const user = auth.currentUser;
						if (user) {
							const profile = await getUserProfile(user.uid);
							const plan = (profile?.planState || "free").toLowerCase();
							if (plan !== "free") break;
						}
						tries++;
						await new Promise(res => setTimeout(res, 2000));
					}
				};
				pollForPlan();
			} else {
				fetchUserPlan();
			}
		}, []);

	// Fetch user's owned and shared properties
	const fetchUserProperties = async (userId: string) => {
		setPropertiesLoading(true);
		try {
			const props = await getAllPropertiesForUser(userId);
			setUserProperties(props);
		} catch (e) {
			setUserProperties([]);
		} finally {
			setPropertiesLoading(false);
		}
	};

	const handleChoosePlan = async (plan: string) => {
		// If annual, append _annual to plan name
		let planParam = plan;
		if (billing === "annually" && (plan === "basic" || plan === "plus")) {
			planParam = plan + "_annual";
		}

		// Check if this is an upgrade and show confirmation modal
		if (isUpgrade(planState, planParam)) {
			setPendingUpgradePlan(planParam);
			setShowUpgradeModal(true);
			return;
		}

		// Proceed with plan selection (downgrades or same-tier changes)
		await proceedWithPlanChange(planParam);
	};

	const proceedWithPlanChange = async (planParam: string) => {
		setSelectedPlan(planParam);
		setLoading(true);
		setError("");
		try {
			const auth = getAuth();
			const user = auth.currentUser;
			if (!user) throw new Error("You must be logged in.");
			const res = await fetch("https://createstripesession-kgqlakneiq-uc.a.run.app", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.uid,
					plan: planParam,
				}),
			});
			const result = await res.json();
			console.log('Stripe backend response:', result);
			if (result.url) {
				window.location.href = result.url;
				return;
			}
			if (result.success) {
				if (sessionStorage.getItem('pendingSharedProperties')) {
					await fetchUserPlan(result.updatedPlan);
					window.location.href = 'https://app.allproperly.com/';
					return;
				} else {
					await fetchUserPlan(result.updatedPlan);
					setError("");
					return;
				}
			}
			// Downgrade error handling
			if (result.error && result.totalCount && result.limit) {
				setDowngradeInfo(result);
				// Fetch properties for modal
				const auth = getAuth();
				const user = auth.currentUser;
				if (user) {
					await fetchUserProperties(user.uid);
				}
				// Default: all properties untoggled (OFF)
				const toggles: {[id: string]: boolean} = {};
				userProperties.forEach((p) => {
					toggles[p.id] = false;
				});
				setPropertyToggles(toggles);
				setShowDowngradeModal(true);
				setError("");
				return;
			}
			if (result.error) {
				setError(result.error);
				return;
			}
			setError("Unexpected response from payment service.");
		} catch (err: any) {
			if (err.message === 'Failed to fetch') {
				setError("Unable to connect to payment service. Please try again later.");
			} else {
				setError(err.message || "Payment error");
			}
		} finally {
			setLoading(false);
			setSelectedPlan("");
		}
	};

	// Modal handlers
	const handleToggleProperty = (id: string) => {
		setPropertyToggles(prev => ({ ...prev, [id]: !prev[id] }));
	};
	const handleCancelDowngrade = () => {
		setShowDowngradeModal(false);
		setDowngradeInfo(null);
	};

	// Upgrade confirmation modal handlers
	const handleCancelUpgrade = () => {
		setShowUpgradeModal(false);
		setPendingUpgradePlan("");
	};

	const handleConfirmUpgrade = async () => {
		setShowUpgradeModal(false);
		await proceedWithPlanChange(pendingUpgradePlan);
		setPendingUpgradePlan("");
	};
	const handleContinueDowngrade = async () => {
		// Count selected properties (toggled ON)
		const selectedCount = Object.values(propertyToggles).filter(Boolean).length;
		const limit = downgradeInfo?.limit || 0;
		if (selectedCount > limit) {
			setLimitErrorMsg(`You can only keep up to ${limit} properties for this plan. Please select ${limit} or fewer properties.`);
			setShowLimitErrorModal(true);
			return;
		}
		setLoading(true);
		// Remove unselected properties
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) {
			setLoading(false);
			setShowDowngradeModal(false);
			setDowngradeInfo(null);
			setError("You must be logged in.");
			return;
		}
		const unselectedProps = userProperties.filter(p => !propertyToggles[p.id]);
		for (const prop of unselectedProps) {
			try {
				const propRef = doc(db, "properties", prop.id);
				const propSnap = await getDoc(propRef);
				if (!propSnap.exists()) continue;
				const data = propSnap.data();
				if (data.ownerId === user.uid) {
					// Owned property: delete
					await deleteDoc(propRef);
				} else if (Array.isArray(data.sharedWith)) {
					// Shared property: remove user from sharedWith
					const newSharedWith = data.sharedWith.filter((sw: any) => sw.userId !== user.uid);
					await updateDoc(propRef, { sharedWith: newSharedWith });
				}
			} catch (err) {
				console.error("Error removing property:", err);
			}
		}
		// After removal, retry backend downgrade
		try {
			const planParam = downgradeInfo?.plan;
			const res = await fetch("https://createstripesession-kgqlakneiq-uc.a.run.app", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.uid,
					plan: planParam,
				}),
			});
			const result = await res.json();
			if (result.success) {
				await fetchUserPlan(result.updatedPlan);
				setError("");
			} else if (result.error) {
				setError(result.error);
			} else {
				setError("Unexpected response from payment service.");
			}
		} catch (err) {
			setError("Unable to connect to payment service. Please try again later.");
		} finally {
			setLoading(false);
			setShowDowngradeModal(false);
			setDowngradeInfo(null);
		}
	};

	return (
	<>
	<Box
		sx={{
			minHeight: "100vh",
			width: sidebar ? "calc(100vw - 75px)" : "calc(100vw - 18vw)",
			bgcolor: "#F9F9F9",
			ml: sidebar ? '75px' : '18vw',
			px: { xs: 1, sm: 4 },
			py: { xs: 2, sm: 4 },
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			fontFamily: 'Nunito, Arial, sans-serif',
			position: 'relative',
			overflowX: 'hidden'
		}}
	>
		{/* Top left button */}
		<Box sx={{ position: 'absolute', left: 32, zIndex: 2, top: 80 }}>
			<Button
				variant="outlined"
				startIcon={
					<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M14.5 11H7.5" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						<path d="M10 8.5L7.5 11L10 13.5" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
				}
				sx={{
					borderRadius: 2,
					boxShadow: 'none',
					fontWeight: 550,
					fontSize: 14,
					px: 2.5,
					py: 1.2,
					fontFamily: 'Nunito, Arial, sans-serif',
					background: '#fff',
					color: '#222',
					border: '1px solid #E0E0E0',
					textTransform: 'none',
					minWidth: 0,
					'&:hover': { background: '#F5F5F5', borderColor: '#B0B0B0' }
				}}
				onClick={() => { sessionStorage.setItem('onBilling', 'true'); onBilling(); }}
			>
				Go Back
			</Button>
		</Box>
		{/* Top right button */}
		<Box sx={{ position: 'absolute', right: 32, zIndex: 2, top: 80 }}>
			<Button
				variant="outlined"
				sx={{
					borderRadius: 2,
					boxShadow: 'none',
					fontWeight: 550,
					fontSize: 14,
					fontFamily: 'Nunito, Arial, sans-serif',
					px: 2.5,
					py: 1.2,
					background: '#fff',
					color: '#222',
					border: '1px solid #E0E0E0',
					textTransform: 'none',
					minWidth: 0,
					'&:hover': { background: '#F5F5F5', borderColor: '#B0B0B0' }
				}}
				onClick={() => setShowDeleteModal(true)}
			>
				Cancel Subscription
			</Button>
			{/* Shared backdrop for delete modals */}
			{(showDeleteModal || showDeleteConfirmModal) && createPortal(
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
						setShowDeleteModal(false);
						setShowDeleteConfirmModal(false);
					}}
				/>,
				document.body
			)}
			{/* First Delete Modal (permanently remove) - replaced with Dialog */}
			{showDeleteModal && (
				<Dialog
				open={showDeleteModal}
				onClose={() => setShowDeleteModal(false)}
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
					Delete Account
				</DialogTitle>
				<DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
					<Box
					sx={{
						bgcolor: '#F9B55D',
						color: '#343748',
						borderRadius: '10px',
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
					You are about to delete your account permanently. Are you sure you want to continue?
					</Box>
					<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
					<Button
						onClick={() => { setShowDeleteModal(false); setShowDeleteConfirmModal(true); }}
						sx={{
						borderRadius: '8px',
						minWidth: 120,
						height: 44,
						bgcolor: '#E57373',
						color: 'rgba(255, 255, 255, 1)',
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
						onClick={() => setShowDeleteModal(false)}
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
			)}
			{/* Second Confirm Modal (cannot be undone) */}
			{showDeleteConfirmModal && (
				<Dialog
				open={showDeleteConfirmModal}
				onClose={() => setShowDeleteConfirmModal(false)}
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
					Delete Account
				</DialogTitle>
				<DialogContent sx={{ px: 3, pt: 0, pb: 3 }}>
					<Box
					sx={{
						bgcolor: '#F9B55D',
						color: '#343748',
						borderRadius: '10px',
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
					Are you sure you want to remove your account? This CANNOT be undone.
					</Box>
					<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
					<Button
						onClick={() => setShowDeleteConfirmModal(false)}
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
						onClick={handleDeleteSubscription}
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
						{deleteLoading ? 'Deleting...' : 'Delete'}
					</Button>
					</Box>
				</DialogContent>
				</Dialog>
			)}
		</Box>
		<Box sx={{ width: "100%", mb: 1 }}>
				<Typography
					variant="h5"
					sx={{ fontWeight: 550, fontSize: 18, color: '#222', fontFamily: 'Nunito, Arial, sans-serif', mb: 4 }}
				>
					Upgrade Plans
				</Typography>
				<Typography
					variant="h3"
					sx={{
						fontWeight: 550,
						textAlign: "center",
						mb: 0.5,
						color: "#222",
						fontFamily: "Nunito, Arial, sans-serif",
						fontSize: 40,
					}}
				>
					Plans & Pricing
				</Typography>
				<Typography
					sx={{
						mb: 3,
						textAlign: "center",
						color: "#222",
						fontSize: 20,
						fontWeight: 400,
						fontFamily: 'Nunito, Arial, sans-serif',
					}}
				>
					You can upgrade or downgrade at any time.
				</Typography>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						mb: 1,
						justifyContent: "center",
						gap: 2,
						fontFamily: 'Nunito, Arial, sans-serif',
					}}
				>
					<Typography
						sx={{
							fontWeight: 600,
							cursor: 'pointer',
							fontSize: 17,
							color: "#222",
							fontFamily: 'Nunito, Arial, sans-serif',
						}}
						onClick={() => setBilling("monthly")}
					>
						Monthly
					</Typography>
					<Box sx={{ position: "relative", width: 50, height: 28, mx: 2, cursor: "pointer" }} onClick={() => setBilling(billing === "monthly" ? "annually" : "monthly") }>
						<Box
							sx={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: "100%",
								bgcolor: "#89AE99",
								borderRadius: 14,
								transition: "background 0.2s",
							}}
						></Box>
						<Box
							sx={{
								position: "absolute",
								top: 4,
								left: billing === "monthly" ? 6 : 26,
								width: 19,
								height: 19,
								bgcolor: "#fff",
								borderRadius: "50%",
								boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
								transition: "left 0.2s, background 0.2s",
							}}
						></Box>
					</Box>
					<Typography
						sx={{
							fontWeight: 600,
							cursor: 'pointer',
							fontSize: 17,
							color: "#222",
							fontFamily: 'Nunito, Arial, sans-serif',
						}}
						onClick={() => setBilling("annually")}
					>
						Annually
					</Typography>
				</Box>
				<Box
					sx={{
						display: "flex",
						gap: 4,
						justifyContent: "center",
						alignItems: "stretch",
						width: "100%",
						fontFamily: 'Nunito, Arial, sans-serif',
						py: 6,
					}}
				>
					{(planData[billing as keyof PlanData] as Plan[]).map((plan: Plan) => {
						let isCurrent = false;
						// Map planState to correct card selection
						if (planState === "free" && plan.name === "Free") isCurrent = true;
						if (billing === "monthly") {
							if (planState === "basic" && plan.name === "Basic") isCurrent = true;
							if (planState === "plus" && plan.name === "Plus") isCurrent = true;
						} else if (billing === "annually") {
							if (planState === "basic_annual" && plan.name === "Basic") isCurrent = true;
							if (planState === "plus_annual" && plan.name === "Plus") isCurrent = true;
						}
						// Determine the plan key used in selectedPlan (e.g., "plus_annual" or "basic")
						let planKey = plan.name.toLowerCase();
						if (billing === "annually" && (planKey === "basic" || planKey === "plus")) {
							planKey = planKey + "_annual";
						}
						const isProcessing = loading && selectedPlan === planKey;
						return (
							<Box
								key={plan.name}
								sx={{
									bgcolor: "#fff",
									borderRadius: 2,
									boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
									p: { xs: 3, sm: 3.4 },
									maxWidth: 370,
									minWidth: 320,
									flex: 1,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									border: "1px solid #E0E0E0",
									mx: 2,
									mt: 1,
									height: 'fit-content',
									position: "relative",
									fontFamily: 'Nunito, Arial, sans-serif',
								}}
							>
								<Typography
									variant="h5"
									sx={{
										fontWeight: 550,
										mb: plan.name == "Free" ? 3 : 0,
										color: "#222",
										textAlign: "left",
										fontSize: 26,
										fontFamily: 'Nunito, Arial, sans-serif',
										width: '100%',
									}}
								>
									{plan.name}
								</Typography>
								<Typography
									variant="h6"
									sx={{
										fontWeight: 400,
										mb: billing === 'annually' && plan.name != "Free" ? plan.subtext ? -0.5 : 4 : plan.subtext ? -0.5 : 1,
										color: '#212121',
										textAlign: "left",
										fontSize: 22,
										fontFamily: 'Nunito, Arial, sans-serif',
										opacity: 0.6,
										width: '100%',
									}}
								>
									{plan.price}
								</Typography>
								{plan.subtext && (
									<Typography
										sx={{
											fontWeight: 400,
											mb: 2,
											color: '#212121',
											textAlign: "left",
											fontSize: 16,
											fontFamily: 'Nunito, Arial, sans-serif',
											opacity: 0.6,
											width: '100%',
										}}
									>
										{plan.subtext}
									</Typography>
								)}
								<Box sx={{ mb: 3, width: "100%" }}>
									{plan.features.map((f: PlanFeature, i: number) => (
										<Box
											key={i}
											sx={{
												display: "flex",
												alignItems: "center",
												mb: 1,
												gap: 1,
											}}
										>
											<Box
												sx={{
													width: 24,
													height: 24,
													borderRadius: "6px",
													bgcolor: '#fff',
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													mr: 2,
													p: 0,
												}}
											>
												{f.checked ? (
													<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													  <path fillRule="evenodd" clipRule="evenodd" d="M16.334 2.75H7.665C4.644 2.75 2.75 4.889 2.75 7.916V16.084C2.75 19.111 4.635 21.25 7.665 21.25H16.333C19.364 21.25 21.25 19.111 21.25 16.084V7.916C21.25 4.889 19.364 2.75 16.334 2.75Z" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
													  <path d="M8.43945 12L10.8135 14.373L15.5595 9.62695" stroke="#89AE99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
													</svg>
												) : (
													f.text === 'Task creation or sharing' ? (
														<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
														  <path d="M14.3955 9.59473L9.60352 14.3867" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
														  <path d="M14.3976 14.3898L9.60156 9.59277" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
														  <path fillRule="evenodd" clipRule="evenodd" d="M16.335 2.75H7.66598C4.64498 2.75 2.75098 4.889 2.75098 7.916V16.084C2.75098 19.111 4.63598 21.25 7.66598 21.25H16.334C19.365 21.25 21.251 19.111 21.251 16.084V7.916C21.251 4.889 19.365 2.75 16.335 2.75Z" stroke="#FF5F57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
														</svg>
													) : (
														<span
															style={{
																color: "#F36A6A",
																fontWeight: 550,
																fontSize: 18,
															}}
														>
															✗
														</span>
													)
												)}
											</Box>
											<Typography
												sx={{
													fontWeight: 400,
													color: "#222",
													fontSize: 15,
													fontFamily: 'Nunito, Arial, sans-serif',
												}}
											>
												{f.text.startsWith('Manage up to 5 properties') ? (
													<>
														Manage up to <b style={{ fontWeight: 550 }}>5 properties</b>{f.text.replace('Manage up to 5 properties', '')}
													</>
												) : f.text.startsWith('Manage up to 10 properties') ? (
													<>
														Manage up to <b style={{ fontWeight: 550 }}>10 properties</b>{f.text.replace('Manage up to 10 properties', '')}
													</>
												) : (
													f.text
												)}
											</Typography>
										</Box>
									))}
								</Box>
								<Button
									variant={isCurrent ? "outlined" : "contained"}
									sx={{
										width: "100%",
										bgcolor: isCurrent ? "#89AE99" : "#E8E8E8",
										color: isCurrent ? "white !important" : "black",
										fontWeight: 600,
										borderRadius: 6,
										py: 0.5,
										fontSize: 14,
										fontFamily: 'Nunito, Arial, sans-serif',
										boxShadow: "none",
										textTransform: "none",
										letterSpacing: 0,
										opacity: isProcessing ? 0.7 : 1,
										cursor: (isProcessing || profileLoading) ? "not-allowed" : "pointer",
										'&:hover': { bgcolor: '#89AE99', color: 'white' },
									}}
									onClick={() =>
										!isCurrent &&
										!loading &&
										!profileLoading &&
										!isProcessing &&
										handleChoosePlan(plan.name.toLowerCase())
									}
								>
									{isCurrent ? (
										"Current Plan"
									) : isProcessing ? (
										<CircularProgress size={22} color="inherit" />
									) : (
										"Choose Plan"
									)}
								</Button>
							</Box>
						);
					})}
				</Box>
				{error && (
					<Typography
						color="error"
						sx={{ mt: 2, textAlign: "center", fontFamily: 'Nunito, Arial, sans-serif' }}
					>
						{error}
					</Typography>
				)}
			</Box>
		</Box>
	{/* Downgrade Modal */}
		{/* Property Limit Error Modal */}
		<Modal open={showLimitErrorModal} onClose={() => setShowLimitErrorModal(false)}>
			<Box sx={{
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				bgcolor: "#fff",
				borderRadius: 2,
				boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
				p: 0,
				minWidth: 390,
				maxWidth: 480,
				width: "90%",
				display: "flex",
				flexDirection: "column",
				alignItems: "stretch",
				fontFamily: "Nunito, Arial, sans-serif"
			}}>
				<Box sx={{ px: 4, pt: 4 }}>
					<Typography variant="subtitle1" sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, mb: 2, textAlign: "left", fontSize: 20, color: "#222" }}>
						Property selection exceeds plan limit
					</Typography>
					<Box sx={{ fontFamily: 'Nunito, Arial, sans-serif', bgcolor: "#F6B26B", borderRadius: 2, px: 3, py: 2, mb: 3 }}>
						<Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontSize: 17, color: "#222" }}>
							{limitErrorMsg}
						</Typography>
					</Box>
				</Box>
				<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, width: "100%", px: 4, pb: 4 }}>
					<Button
						variant="outlined"
						onClick={() => setShowLimitErrorModal(false)}
						sx={{
							minWidth: 120,
							fontWeight: 550,
							fontSize: 15,
							bgcolor: "#fff",
							color: "#222",
							textTransform: "none",
							border: "2px solid #999",
							boxShadow: "none",
							borderRadius: 2,
							fontFamily: 'Nunito, Arial, sans-serif',
							py: 1,
							mr: 1,
							'&:hover': { bgcolor: "#f5f5f5", borderColor: "#777474" }
						}}
					>
						Cancel
					</Button>
				</Box>
			</Box>
		</Modal>
		{/* Cancel Subscription 2-step modal */}
		<Modal open={showCancelModal} onClose={() => setShowCancelModal(false)}>
			<Box sx={{
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				bgcolor: "#fff",
				borderRadius: 3,
				boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
				p: 0,
				minWidth: 390,
				maxWidth: 480,
				width: "90%",
				display: "flex",
				flexDirection: "column",
				alignItems: "stretch",
				fontFamily: "Nunito, Arial, sans-serif"
			}}>
				<Box sx={{ px: 4, pt: 4 }}>
					<Typography variant="h6" sx={{ fontWeight: 550, mb: 2, textAlign: "left", fontSize: 22, color: "#222" }}>
						Delete Account
					</Typography>
					<Box sx={{ bgcolor: "#F6B26B", borderRadius: 2, px: 3, py: 2, mb: 3 }}>
						<Typography sx={{ fontSize: 17, color: "#222" }}>
							{cancelStep === 1
								? "You are about to delete your account permanently. Are you sure you want to continue?"
								: "Are you sure you want to remove your account? This CANNOT be undone."}
						</Typography>
					</Box>
				</Box>
				<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, width: "100%", px: 4, pb: 4 }}>
					{cancelStep === 1 ? (
						<>
							<Button
								variant="contained"
								sx={{
									minWidth: 120,
									fontWeight: 550,
									fontSize: 16,
									bgcolor: "#F36A6A",
									color: "#fff",
									borderRadius: 2,
									py: 1.2,
									boxShadow: "none",
									'&:hover': { bgcolor: "#d32f2f" }
								}}
								onClick={() => setCancelStep(2)}
							>
								Delete
							</Button>
							<Button
								variant="outlined"
								onClick={() => setShowCancelModal(false)}
								sx={{
									minWidth: 120,
									fontWeight: 550,
									fontSize: 16,
									bgcolor: "#fff",
									color: "#222",
									border: "2px solid #999",
									boxShadow: "none",
									borderRadius: 2,
									py: 1.2,
									'&:hover': { bgcolor: "#f5f5f5", borderColor: "#777474" }
								}}
							>
								Cancel
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outlined"
								onClick={() => setShowCancelModal(false)}
								sx={{
									minWidth: 120,
									fontWeight: 550,
									fontSize: 16,
									bgcolor: "#fff",
									color: "#222",
									border: "2px solid #999",
									boxShadow: "none",
									borderRadius: 2,
									py: 1.2,
									'&:hover': { bgcolor: "#f5f5f5", borderColor: "#666" }
								}}
							>
								Cancel
							</Button>
							<Button
								variant="contained"
								sx={{
									minWidth: 120,
									fontWeight: 550,
									fontSize: 16,
									bgcolor: "#F36A6A",
									color: "#fff",
									borderRadius: 2,
									py: 1.2,
									boxShadow: "none",
									'&:hover': { bgcolor: "#d32f2f" }
								}}
								onClick={() => {
									setShowCancelModal(false);
									// TODO: Add actual cancel subscription logic here
								}}
							>
								Delete
							</Button>
						</>
					)}
				</Box>
			</Box>
		</Modal>
		<Modal open={showDowngradeModal} onClose={handleCancelDowngrade}>
			<Box sx={{
				bgcolor: "#fff",
				borderRadius: 2,
				boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
				p: 0/.3,
				maxWidth: 600,
				mx: "auto",
				my: 8,
				display: "flex",
				flexDirection: "column",
				alignItems: "stretch",
				fontFamily: "Nunito, Arial, sans-serif"
			}}>
				<Box sx={{ px: 4, pt: 4 }}>
					<Typography variant="h6" sx={{ fontFamily: "Nunito, Arial, sans-serif", fontWeight: 550, mb: 2, color: '#222', textAlign: "left", fontSize: 22 }}>
						{downgradeInfo?.plan === "basic" || downgradeInfo?.plan === "basic_annual"
							? "You're switching to the Basic Plan"
							: "You're switching to the Free Plan"}
					</Typography>
					<Typography component="div" sx={{ fontFamily: "Nunito, Arial, sans-serif", textAlign: "left", fontSize: 17, color: "#222" }}>
						You’ve selected the <b>{downgradeInfo?.plan === "basic" || downgradeInfo?.plan === "basic_annual" ? "Basic" : "Free"} Plan</b>, which only allows you to have <b>{downgradeInfo?.limit} {downgradeInfo?.limit === 1 ? "property" : "properties"}</b>.<br />
						Right now, you have more properties than this plan supports.<br />
						<ul style={{ textAlign: "left", margin: "8px 0 0 24px", fontSize: 16 }}>
							<li>The properties you leave toggled ON will remain in your account.</li>
							<li>Any properties toggled OFF will be removed.</li>
						</ul>
						<br />
						If you’d like to keep managing all your properties, you can stay on the <b>{planState.toLowerCase().startsWith("basic") ? "Basic" : "Plus"} Plan</b> instead.
					</Typography>
					<Typography sx={{ fontFamily: 'Nunito, Arial, sans-serif', fontWeight: 550, fontSize: 16, mt: 2, color: "#222" }}>Buttons:</Typography>
					<ul style={{ fontFamily: "Nunito, Arial, sans-serif", margin: "0 0 12px 24px", fontSize: 15, color: "#222" }}>
						<li>Cancel (Stay on Plus Plan)</li>
						<li>Continue (Downgrade to {downgradeInfo?.plan === "basic" || downgradeInfo?.plan === "basic_annual" ? "Basic" : "Free"} Plan)</li>
					</ul>
				</Box>
				<Divider sx={{ width: "100%", mb: 2 }} />
				<Box sx={{ width: "100%", px: 4, mb: 2 }}>
					{propertiesLoading ? (
						<Typography sx={{ textAlign: "center" }}>Loading properties...</Typography>
					) : (
						<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
							{userProperties.map((p) => (
								<Box key={p.id} sx={{ display: "flex", alignItems: "center" }}>
									<Switch
									checked={!!propertyToggles[p.id]}
									onChange={() => handleToggleProperty(p.id)}
									sx={{
										width: 26,
										height: 16,
										p: 0,
										mr: 1,
										display: 'flex',
										alignItems: 'center',
										'& .MuiSwitch-switchBase': {
										top: '50%',
										transform: 'translateY(-50%)',
										'&.Mui-checked': {
											transform: 'translateX(8px) translateY(-50%)',
											color: '#fff',
											'& + .MuiSwitch-track': {
											backgroundColor: '#89AE99',
											opacity: 1,
											},
										},
										},
										'& .MuiSwitch-thumb': {
										width: 10,
										height: 10,
										boxShadow: 'none',
										backgroundColor: '#fff',
										transition: 'all 0.3s',
										position: 'relative',
										left: '-5px',
										},
										'& .MuiSwitch-track': {
										borderRadius: 18,
										backgroundColor: '#A8A8A8',
										opacity: 1,
										transition: 'all 0.3s',
										},
									}}
									/>
									<Avatar src={p.image || '/homeicon.png'} sx={{ width: 40, height: 40, mr: 2, border: "2px solid #eee" }} />
									<Box>
										<Typography sx={{ fontFamily: "Nunito, Arial, sans-serif", fontWeight: 550, fontSize: 17, color: "#222" }}>{p.name}</Typography>
										{p.sharedBy ? (
											<Typography sx={{ fontFamily: "Nunito, Arial, sans-serif", fontSize: 15, color: "#888" }}>Share by: {p.sharedBy}</Typography>
										) : (
											<p>owned</p>
										)}
									</Box>
								</Box>
							))}
						</Box>
					)}
				</Box>
				<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, width: "100%", px: 4, pb: 4, mt: 2 }}>
					<Button
						variant="outlined"
						onClick={handleCancelDowngrade}
						sx={{
							fontWeight: 400,
							fontSize: 15,
							bgcolor: "#fff",
							color: "#222",
							border: "2px solid #E1DEDB",
							boxShadow: "none",
							borderRadius: '8px',
							textTransform: "none",
							py: 1.2,
							px: 3,
							'&:hover': { borderRadius: '8px', bgcolor: "#f5f5f5", borderColor: "#777474" }
						}}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						color="success"
						onClick={handleContinueDowngrade}
						disabled={Object.values(propertyToggles).filter(Boolean).length === 0}
						sx={{
							fontWeight: 400,
							fontSize: 15,
							fontFamily: "Nunito, Arial, sans-serif",
							bgcolor: "#89AE99",
							color: "#fff",
							boxShadow: "none",
							borderRadius: 2,
							textTransform: "none",
							px: 3,
							py: 1,
							ml: 1,
							opacity: Object.values(propertyToggles).filter(Boolean).length === 0 ? 0.5 : 1,
							cursor: Object.values(propertyToggles).filter(Boolean).length === 0 ? 'not-allowed' : 'pointer'
						}}
					>
						Continue
					</Button>
				</Box>
			</Box>
		</Modal>

		{/* Upgrade Confirmation Modal */}
		<Modal open={showUpgradeModal} onClose={handleCancelUpgrade}>
			<Box sx={{
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				bgcolor: "#fff",
				borderRadius: 2,
				boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
				p: 0,
				minWidth: 400,
				maxWidth: 500,
				width: "90%",
				display: "flex",
				flexDirection: "column",
				alignItems: "stretch",
				fontFamily: "Nunito, Arial, sans-serif"
			}}>
				<Box sx={{ px: 4, pt: 4, pb: 3 }}>
					<Typography variant="h6" sx={{ 
						fontWeight: 550, 
						mb: 2, 
						textAlign: "left", 
						fontSize: 22, 
						color: "#222",
						fontFamily: "Nunito, Arial, sans-serif"
					}}>
						You are about to change your plan...
					</Typography>
					<Typography sx={{ 
						fontSize: 17, 
						color: "#666",
						fontFamily: "Nunito, Arial, sans-serif",
						mb: 3
					}}>
						Are you sure you want to change plans?
					</Typography>
				</Box>
				<Box sx={{ 
					display: "flex", 
					justifyContent: "flex-end", 
					gap: 2, 
					width: "100%", 
					px: 4, 
					pb: 4 
				}}>
					<Button
						variant="outlined"
						onClick={handleCancelUpgrade}
						sx={{
							minWidth: 120,
							fontWeight: 400,
							fontSize: 16,
							bgcolor: "#fff",
							color: "#222",
							textTransform: "none",
							border: "1.5px solid #D9D9D9",
							boxShadow: "none",
							borderRadius: 2,
							py: 1.2,
							fontFamily: 'Nunito, Arial, sans-serif',
							'&:hover': { bgcolor: "#f5f5f5", borderColor: "#B0B8C1" }
						}}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={handleConfirmUpgrade}
						sx={{
							minWidth: 120,
							fontWeight: 400,
							fontSize: 16,
							bgcolor: "#89AE99",
							color: "#fff",
							borderRadius: 2,
							py: 1.2,
							boxShadow: "none",
							textTransform: "none",
							fontFamily: 'Nunito, Arial, sans-serif',
							'&:hover': { bgcolor: "#7A9B8A" }
						}}
					>
						Confirm
					</Button>
				</Box>
			</Box>
		</Modal>
		</>
	);
}