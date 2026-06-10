import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Copy, CreditCard, Info, Landmark, Lock, QrCode, ShieldCheck, Smartphone, Wallet, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ModalFrame from "../components/ModalFrame";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import bcaLogo from "../assets/banks/bca.svg";
import bniLogo from "../assets/banks/bni.svg";
import briLogo from "../assets/banks/bri.svg";
import mandiriLogo from "../assets/banks/mandiri.svg";
import bsiLogo from "../assets/banks/bsi.svg";
import muamalatLogo from "../assets/banks/muamalat.png";
import alfamartLogo from "../assets/banks/alfamart.svg";
import indomaretLogo from "../assets/banks/indomaret.svg";

function loadExternalScript(id, src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      const existingSrc = existing.getAttribute("src") || "";
      const nextSrc = new URL(src, window.location.href).href;
      if (existingSrc === nextSrc) {
        resolve(existing);
        return;
      }
      existing.remove();
      if (id === "midtrans-snap-js" && window.snap) {
        delete window.snap;
      }
      if (id === "doku-jokul-js" && window.loadJokulCheckout) {
        delete window.loadJokulCheckout;
      }
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    Object.entries(attributes).forEach(([key, value]) => {
      if (value) {
        script.setAttribute(key, value);
      }
    });
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Gagal memuat script ${src}`));
    document.body.appendChild(script);
  });
}

function redirectToGateway(url, navigationBypassRef, setAllowNavigation) {
  if (!url) return false;
  navigationBypassRef.current = true;
  setAllowNavigation(true);
  window.location.replace(url);
  return true;
}

async function openGatewayPopup({ payload, navigate, navigationBypassRef, setAllowNavigation, setBusy, setMessage }) {
  const provider = String(payload?.popup_provider || "").toLowerCase();
  const referenceNo = String(payload?.reference_no || "");
  const redirectUrl = String(payload?.redirect_url || "");
  const transactionUrl = referenceNo
    ? `/orang-tua/transaksi?gateway=${encodeURIComponent(provider)}&ref=${encodeURIComponent(referenceNo)}`
    : "/orang-tua/transaksi";

  if (provider === "midtrans") {
    const scriptUrl = payload?.popup_script_url;
    const clientKey = payload?.popup_client_key;
    const snapToken = payload?.popup_token;
    if (!scriptUrl || !clientKey || !snapToken) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Konfigurasi popup Midtrans belum lengkap");
    }

    await loadExternalScript("midtrans-snap-js", scriptUrl, { "data-client-key": clientKey });
    if (!window.snap || typeof window.snap.pay !== "function") {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Snap.js Midtrans tidak tersedia");
    }

    setBusy(false);
    try {
      window.snap.pay(snapToken, {
        onSuccess: () => {
          navigationBypassRef.current = true;
          setAllowNavigation(true);
          navigate(transactionUrl);
        },
        onPending: () => {
          navigationBypassRef.current = true;
          setAllowNavigation(true);
          navigate(transactionUrl);
        },
        onError: (result) => {
          setBusy(false);
          const statusMessage = String(result?.status_message || "");
          if (
            statusMessage.toLowerCase().includes("postmessage") &&
            redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)
          ) {
            return;
          }
          setMessage({
            type: "error",
            text: statusMessage || "Pembayaran Midtrans gagal diproses",
          });
        },
        onClose: () => {
          setBusy(false);
          setMessage({
            type: "warning",
            text: "Popup pembayaran ditutup sebelum transaksi selesai.",
          });
        },
      });
    } catch (error) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw error;
    }
    return true;
  }

  if (provider === "doku") {
    const scriptUrl = payload?.popup_script_url;
    const paymentUrl = payload?.popup_payment_url;
    if (!scriptUrl || !paymentUrl) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Konfigurasi popup DOKU belum lengkap");
    }

    await loadExternalScript("doku-jokul-js", scriptUrl);
    if (typeof window.loadJokulCheckout !== "function") {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Jokul Checkout JS tidak tersedia");
    }

    setBusy(false);
    window.loadJokulCheckout(paymentUrl);
    return true;
  }

  return false;
}

const DEFAULT_PAYMENT_CHANNELS = [
  {
    value: "Transfer Bank",
    label: "Transfer Bank",
    accent: "border-blue-200 bg-blue-50/80 hover:border-blue-300 hover:bg-blue-100/80",
    badge: "bg-blue-100 text-blue-700",
    hint: "Transfer langsung ke rekening sekolah",
  },
  {
    value: "QRIS",
    label: "QRIS",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
    hint: "Praktis dipindai lewat mobile banking",
  },
  {
    value: "Virtual Account",
    label: "Virtual Account",
    accent: "border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80",
    badge: "bg-violet-100 text-violet-700",
    hint: "Nomor virtual account otomatis dari sistem",
  },
  {
    value: "E-Wallet",
    label: "E-Wallet",
    accent: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80",
    badge: "bg-amber-100 text-amber-700",
    hint: "Bayar lewat dompet digital yang tersedia",
  },
];

const IPAYMU_DIRECT_CHANNELS = [
  {
    value: "ipaymu-va-bri",
    label: "BRI Virtual Account",
    accent: "border-blue-200 bg-blue-50/80 hover:border-blue-300 hover:bg-blue-100/80",
    badge: "bg-blue-100 text-blue-700",
    hint: "VA otomatis khusus BRI dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-bni",
    label: "BNI Virtual Account",
    accent: "border-orange-200 bg-orange-50/80 hover:border-orange-300 hover:bg-orange-100/80",
    badge: "bg-orange-100 text-orange-700",
    hint: "VA otomatis khusus BNI dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-bca",
    label: "BCA Virtual Account",
    accent: "border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-100/80",
    badge: "bg-sky-100 text-sky-700",
    hint: "VA otomatis khusus BCA dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-mandiri",
    label: "Mandiri Virtual Account",
    accent: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80",
    badge: "bg-amber-100 text-amber-700",
    hint: "VA otomatis khusus Mandiri dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-permata",
    label: "Permata Virtual Account",
    accent: "border-rose-200 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-100/80",
    badge: "bg-rose-100 text-rose-700",
    hint: "VA otomatis khusus Permata dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-bsi",
    label: "BSI Virtual Account",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
    hint: "VA otomatis khusus BSI dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-va-bmi",
    label: "Muamalat Virtual Account",
    accent: "border-lime-200 bg-lime-50/80 hover:border-lime-300 hover:bg-lime-100/80",
    badge: "bg-lime-100 text-lime-700",
    hint: "VA otomatis khusus Muamalat dari iPaymu Direct Payment",
  },
  {
    value: "ipaymu-qris",
    label: "QRIS",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
    hint: "Tampilkan QRIS iPaymu langsung di popup web ini",
  },
  {
    value: "ipaymu-ewallet-gopay",
    label: "GoPay",
    accent: "border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-100/80",
    badge: "bg-sky-100 text-sky-700",
    hint: "Bayar dengan saldo GoPay via iPaymu Direct Payment",
  },
  {
    value: "ipaymu-ewallet-shopeepay",
    label: "ShopeePay",
    accent: "border-orange-200 bg-orange-50/80 hover:border-orange-300 hover:bg-orange-100/80",
    badge: "bg-orange-100 text-orange-700",
    hint: "Bayar dengan saldo ShopeePay via iPaymu Direct Payment",
  },
  {
    value: "ipaymu-cstore-alfamart",
    label: "Alfamart",
    accent: "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-100/80",
    badge: "bg-red-100 text-red-700",
    hint: "Bayar tunai di Alfamart lewat kode iPaymu",
  },
  {
    value: "ipaymu-cstore-indomaret",
    label: "Indomaret",
    accent: "border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80",
    badge: "bg-violet-100 text-violet-700",
    hint: "Bayar tunai di Indomaret lewat kode iPaymu",
  },
];

const TRIPAY_CHANNELS = [
  {
    value: "tripay-va-bri",
    label: "BRI Virtual Account",
    accent: "border-blue-200 bg-blue-50/80 hover:border-blue-300 hover:bg-blue-100/80",
    badge: "bg-blue-100 text-blue-700",
    hint: "VA BRI dari Tripay",
  },
  {
    value: "tripay-va-bni",
    label: "BNI Virtual Account",
    accent: "border-orange-200 bg-orange-50/80 hover:border-orange-300 hover:bg-orange-100/80",
    badge: "bg-orange-100 text-orange-700",
    hint: "VA BNI dari Tripay",
  },
  {
    value: "tripay-va-bca",
    label: "BCA Virtual Account",
    accent: "border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-100/80",
    badge: "bg-sky-100 text-sky-700",
    hint: "VA BCA dari Tripay",
  },
  {
    value: "tripay-va-mandiri",
    label: "Mandiri Virtual Account",
    accent: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80",
    badge: "bg-amber-100 text-amber-700",
    hint: "VA Mandiri dari Tripay",
  },
  {
    value: "tripay-va-permata",
    label: "Permata Virtual Account",
    accent: "border-rose-200 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-100/80",
    badge: "bg-rose-100 text-rose-700",
    hint: "VA Permata dari Tripay",
  },
  {
    value: "tripay-qris",
    label: "QRIS",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
    hint: "QRIS direct dari Tripay",
  },
  {
    value: "tripay-retail-alfamart",
    label: "Alfamart",
    accent: "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-100/80",
    badge: "bg-red-100 text-red-700",
    hint: "Bayar tunai di Alfamart lewat Tripay",
  },
  {
    value: "tripay-retail-indomaret",
    label: "Indomaret",
    accent: "border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80",
    badge: "bg-violet-100 text-violet-700",
    hint: "Bayar tunai di Indomaret lewat Tripay",
  },
  {
    value: "tripay-ewallet-ovo",
    label: "OVO",
    accent: "border-fuchsia-200 bg-fuchsia-50/80 hover:border-fuchsia-300 hover:bg-fuchsia-100/80",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    hint: "Redirect ke OVO via Tripay",
  },
  {
    value: "tripay-ewallet-dana",
    label: "DANA",
    accent: "border-cyan-200 bg-cyan-50/80 hover:border-cyan-300 hover:bg-cyan-100/80",
    badge: "bg-cyan-100 text-cyan-700",
    hint: "Redirect ke DANA via Tripay",
  },
  {
    value: "tripay-ewallet-shopeepay",
    label: "ShopeePay",
    accent: "border-orange-200 bg-orange-50/80 hover:border-orange-300 hover:bg-orange-100/80",
    badge: "bg-orange-100 text-orange-700",
    hint: "Redirect ke ShopeePay via Tripay",
  },
];

function normalizeGatewayProviderKey(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "";
  if (provider.includes("ipaymu")) return "ipaymu";
  if (provider.includes("midtrans")) return "midtrans";
  if (provider.includes("doku")) return "doku";
  if (provider.includes("tripay")) return "tripay";
  return provider;
}

function getBankVisual(channelValue, channelLabel) {
  const value = String(channelValue || "").toLowerCase();
  const label = String(channelLabel || "");
  if (value.includes("bca")) return { logo: bcaLogo, alt: "BCA", short: "BCA" };
  if (value.includes("bni")) return { logo: bniLogo, alt: "BNI", short: "BNI" };
  if (value.includes("bri")) return { logo: briLogo, alt: "BRI", short: "BRI" };
  if (value.includes("mandiri")) return { logo: mandiriLogo, alt: "Mandiri", short: "Mandiri" };
  if (value.includes("bsi")) return { logo: bsiLogo, alt: "BSI", short: "BSI" };
  if (value.includes("bmi") || value.includes("muamalat")) return { logo: muamalatLogo, alt: "Muamalat", short: "Muamalat" };
  if (value.includes("permata")) return { logo: null, alt: "Permata", short: "Permata" };
  return { logo: null, alt: label, short: label.replace(" Virtual Account", "") };
}

function getRetailVisual(channelValue, channelLabel) {
  const value = String(channelValue || "").toLowerCase();
  const label = String(channelLabel || "");
  if (value.includes("alfamart")) return { logo: alfamartLogo, alt: "Alfamart", short: "Alfamart" };
  if (value.includes("indomaret")) return { logo: indomaretLogo, alt: "Indomaret", short: "Indomaret" };
  return { logo: null, alt: label, short: label };
}

export default function ParentGatewayPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [gatewayRejection, setGatewayRejection] = useState("");
  const [gatewayPopupData, setGatewayPopupData] = useState(null);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const popConfirmingRef = useRef(false);
  const navigationBypassRef = useRef(false);

  useToastMessage(message, setMessage);

  const requestedBillIds = useMemo(
    () =>
      (searchParams.get("bill_ids") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: billsData }, { data: dashboardData }] = await Promise.all([
          fetchRoute("parent/bills"),
          fetchRoute("parent/dashboard"),
        ]);
        setBills(Array.isArray(billsData) ? billsData : []);
        setSettings(dashboardData?.settings || {});
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat payment gateway",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (allowNavigation) return undefined;

    const handleBeforeUnload = (event) => {
      if (navigationBypassRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [allowNavigation]);

  useEffect(() => {
    if (allowNavigation) return undefined;

    window.history.pushState({ parentGatewayPaymentGuard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || navigationBypassRef.current || popConfirmingRef.current) return;

      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan payment gateway?",
        description: "Pilihan kanal pembayaran akan dibatalkan jika Anda keluar dari halaman ini.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ parentGatewayPaymentGuard: true }, "", window.location.href);
      }

      popConfirmingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allowNavigation, confirm]);

  const selectedBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          requestedBillIds.includes(String(bill.id)) &&
          bill.status !== "paid" &&
          bill.proof_status !== "pending" &&
          bill.proof_status !== "approved",
      ),
    [bills, requestedBillIds],
  );

  const totalPayment = selectedBills.reduce(
    (total, bill) => total + Number(bill.amount || 0),
    0,
  );
  const gatewayEnabled = settings?.payment_gateway_enabled === "1";
  const gatewayProviderKey = normalizeGatewayProviderKey(settings?.payment_gateway_provider || "");
  const gatewayMode = String(settings?.payment_gateway_mode || "redirect").toLowerCase();
  const isIpaymuDirectPopup = gatewayProviderKey === "ipaymu" && gatewayMode === "popup";
  const isTripayPopup = gatewayProviderKey === "tripay" && gatewayMode === "popup";
  const isTripayProvider = gatewayProviderKey === "tripay";
  const tripayPopupChannels = useMemo(
    () => TRIPAY_CHANNELS.filter((channel) => !String(channel.value).startsWith("tripay-ewallet-")),
    [],
  );
  const paymentChannels = useMemo(() => {
    if (isIpaymuDirectPopup) return IPAYMU_DIRECT_CHANNELS;
    if (isTripayProvider) return isTripayPopup ? tripayPopupChannels : TRIPAY_CHANNELS;
    return DEFAULT_PAYMENT_CHANNELS;
  }, [isIpaymuDirectPopup, isTripayPopup, isTripayProvider, tripayPopupChannels]);
  const gatewayModeLabel = isIpaymuDirectPopup || isTripayPopup ? "Popup Direct" : gatewayMode === "popup" ? "Popup" : "Redirect";
  const [selectedChannel, setSelectedChannel] = useState("");
  const [checkoutStep, setCheckoutStep] = useState("choose");

  const chooseChannels = useMemo(() => {
    const supportsGroupedChooser = isIpaymuDirectPopup || isTripayProvider;
    if (!supportsGroupedChooser) return paymentChannels;
    const providerPrefix = gatewayProviderKey === "tripay" ? "tripay" : "ipaymu";
    const retailPrefix = providerPrefix === "tripay" ? "tripay-retail-" : "ipaymu-cstore-";
    const vaChannels = paymentChannels.filter((channel) => String(channel.value).startsWith(`${providerPrefix}-va-`));
    const qrisChannel = paymentChannels.find((channel) => String(channel.value) === `${providerPrefix}-qris`);
    const walletChannels = paymentChannels.filter((channel) => String(channel.value).startsWith(`${providerPrefix}-ewallet-`));
    const retailChannels = paymentChannels.filter((channel) => String(channel.value).startsWith(retailPrefix));
    const items = [];
    if (vaChannels.length) {
      items.push({
        value: `${providerPrefix}-va`,
        label: "Virtual Account",
        hint: "Pilih bank VA pada langkah berikutnya",
        accent: vaChannels[0].accent,
        badge: vaChannels[0].badge,
      });
    }
    if (qrisChannel) items.push(qrisChannel);
    if (walletChannels.length) {
      items.push({
        value: `${providerPrefix}-ewallet`,
        label: "E-Wallet",
        hint: providerPrefix === "tripay" ? "OVO / DANA / ShopeePay" : "GoPay / ShopeePay",
        accent: walletChannels[0].accent,
        badge: walletChannels[0].badge,
      });
    }
    if (retailChannels.length) {
      items.push({
        value: `${providerPrefix}-retail`,
        label: "Retail",
        hint: "Alfamart / Indomaret",
        accent: retailChannels[0].accent,
        badge: retailChannels[0].badge,
      });
    }
    return items.length ? items : paymentChannels;
  }, [gatewayProviderKey, isIpaymuDirectPopup, isTripayProvider, paymentChannels]);

  const vaBankChannels = useMemo(
    () => paymentChannels.filter((channel) => String(channel.value).includes("-va-")),
    [paymentChannels],
  );
  const retailChannels = useMemo(
    () => paymentChannels.filter((channel) => /-(cstore|retail)-/.test(String(channel.value))),
    [paymentChannels],
  );
  const ewalletChannels = useMemo(
    () => paymentChannels.filter((channel) => String(channel.value).includes("-ewallet-")),
    [paymentChannels],
  );
  const [selectedVaBank, setSelectedVaBank] = useState("");
  const [selectedRetail, setSelectedRetail] = useState("");
  const [selectedEwallet, setSelectedEwallet] = useState("");

  useEffect(() => {
    if (!chooseChannels.length) return;
    if (!selectedChannel || !chooseChannels.some((channel) => channel.value === selectedChannel)) {
      setSelectedChannel(chooseChannels[0].value);
    }
  }, [chooseChannels, selectedChannel]);

  useEffect(() => {
    if (!vaBankChannels.length) return;
    if (!selectedVaBank || !vaBankChannels.some((channel) => channel.value === selectedVaBank)) {
      setSelectedVaBank(vaBankChannels[0].value);
    }
  }, [vaBankChannels, selectedVaBank]);
  useEffect(() => {
    if (!retailChannels.length) return;
    if (!selectedRetail || !retailChannels.some((channel) => channel.value === selectedRetail)) {
      setSelectedRetail(retailChannels[0].value);
    }
  }, [retailChannels, selectedRetail]);
  useEffect(() => {
    if (!ewalletChannels.length) return;
    if (!selectedEwallet || !ewalletChannels.some((channel) => channel.value === selectedEwallet)) {
      setSelectedEwallet(ewalletChannels[0].value);
    }
  }, [ewalletChannels, selectedEwallet]);

  const selectedChannelMeta = chooseChannels.find((channel) => channel.value === selectedChannel) || chooseChannels[0] || null;
  const selectedLabel = String(selectedChannelMeta?.label || "").toLowerCase();
  const isQris = selectedLabel.includes("qris");
  const isCard = selectedLabel.includes("kartu") || selectedLabel.includes("card");
  const isWallet = selectedLabel.includes("gopay") || selectedLabel.includes("shopee") || selectedLabel.includes("wallet") || selectedLabel.includes("e-wallet");
  const isVA = selectedLabel.includes("virtual") || selectedLabel.includes("va");
  const isTransfer = selectedLabel.includes("transfer");
  const isGopay = selectedLabel.includes("gopay");
  const isShopee = selectedLabel.includes("shopee");

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan payment gateway?",
      description: "Pilihan kanal pembayaran akan dibatalkan jika Anda keluar dari halaman ini.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) {
      navigationBypassRef.current = true;
      setAllowNavigation(true);
    }
    return confirmed;
  };

  const pay = async (channel) => {
    if (!gatewayEnabled) {
      setMessage({
        type: "warning",
        text: "Payment gateway sedang dinonaktifkan. Gunakan pembayaran manual untuk saat ini.",
      });
      return;
    }

    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Tidak ada tagihan yang dipilih." });
      return;
    }

    try {
      setBusy(true);
      setGatewayRejection("");
      const { data } = await fetchRoute("parent/payments", {
        method: "POST",
        data: {
          bill_ids: selectedBills.map((bill) => bill.id),
          payment_channel: channel,
        },
      });
      if (["ipaymu", "tripay"].includes(String(data?.popup_provider || "").toLowerCase())) {
        setGatewayPopupData(data);
        return;
      }
      if (data?.popup_provider) {
        const opened = await openGatewayPopup({
          payload: data,
          navigate,
          navigationBypassRef,
          setAllowNavigation,
          setBusy,
          setMessage,
        });
        if (opened) {
          return;
        }
      }
      if (data?.redirect_url) {
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        window.location.replace(data.redirect_url);
        return;
      }
      throw new Error(data?.message || "Gagal mendapatkan URL pembayaran");
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || "Gagal memproses pembayaran";
      if (String(errorMessage).toLowerCase().includes("suspicious buyer")) {
        setGatewayRejection(errorMessage);
      }
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setBusy(false);
    }
  };

  const methodIcon = (channelLabel) => {
    const key = String(channelLabel || "").toLowerCase();
    if (key.includes("qris")) return <QrCode size={20} className="text-[#0667ff]" />;
    if (key.includes("kartu") || key.includes("card")) return <CreditCard size={20} className="text-[#0667ff]" />;
    if (key.includes("gopay") || key.includes("shopee") || key.includes("wallet") || key.includes("e-wallet")) return <Wallet size={20} className="text-[#0667ff]" />;
    if (key.includes("virtual") || key.includes("va")) return <Landmark size={20} className="text-[#0667ff]" />;
    return <Building2 size={20} className="text-[#0667ff]" />;
  };

  const actionButtonLabel = isCard ? "Bayar Sekarang" : "Saya Sudah Bayar";

  const groupedPaymentChannels = useMemo(() => {
    const groups = [
      { key: "transfer", title: "Transfer & Virtual Account", items: [] },
      { key: "card", title: "Kartu", items: [] },
      { key: "qris", title: "QRIS", items: [] },
      { key: "wallet", title: "E-Wallet", items: [] },
      { key: "retail", title: "Retail", items: [] },
      { key: "other", title: "Lainnya", items: [] },
    ];

    const pickGroup = (label, value) => {
      const text = `${label} ${value}`.toLowerCase();
      if (text.includes("qris")) return "qris";
      if (text.includes("kartu") || text.includes("card")) return "card";
      if (text.includes("gopay") || text.includes("shopee") || text.includes("wallet") || text.includes("e-wallet")) return "wallet";
      if (text.includes("alfamart") || text.includes("indomaret") || text.includes("retail") || text.includes("cstore")) return "retail";
      if (text.includes("transfer") || text.includes("virtual") || text.includes("va") || text.includes("bank")) return "transfer";
      return "other";
    };

    chooseChannels.forEach((channel) => {
      const key = pickGroup(channel.label, channel.value);
      const group = groups.find((entry) => entry.key === key);
      if (group) group.items.push(channel);
    });

    return groups.filter((group) => group.items.length);
  }, [chooseChannels]);

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(4,103,255,0.12),transparent_34%),radial-gradient(circle_at_88%_24%,rgba(4,103,255,0.1),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto flex h-full max-w-7xl items-stretch">
        <section className="flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/80 shadow-[0_24px_70px_rgba(15,38,82,0.16)] backdrop-blur">

          <div className="flex-1 overflow-hidden px-0 py-0 sm:px-3 sm:py-3 lg:px-4">
            <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,38,82,0.10)] sm:rounded-[18px]">
              <header className="flex flex-col gap-2 bg-gradient-to-br from-[#061d4a] via-[#082b6f] to-[#061d4a] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                    <span className="text-lg font-black tracking-tight">SP</span>
                  </span>
                  <div>
                    <span className="block text-xl font-black tracking-[.22em]">SPPANEL</span>
                    <span className="block text-xs text-white/70">Payment Gateway</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                  onClick={async () => {
                    const confirmed = await confirmLeavePage();
                    if (!confirmed) return;
                    navigate("/orang-tua/tagihan/pembayaran");
                  }}
                >
                  <X size={13} />
                </button>
              </header>

              <main className="grid flex-1 overflow-hidden lg:grid-cols-[1.1fr_.95fr]">
                <section className={`border-b border-slate-200 p-3 sm:p-4 lg:border-b-0 lg:border-r ${checkoutStep === "detail" ? "overflow-y-auto" : ""}`}>
                  {checkoutStep === "choose" ? (
                    <>
                      <h1 className="text-xl font-black text-[#0a2254]">Pilih Metode Pembayaran</h1>
                      <p className="mt-1 text-xs text-slate-600">Pilih metode yang paling nyaman untuk menyelesaikan transaksi.</p>
                      <div className="mt-3 space-y-3">
                        {groupedPaymentChannels.map((group) => (
                          <div key={group.key} className="space-y-2">
                            {group.items.map((channel) => {
                              const active = channel.value === selectedChannel;
                              return (
                                <button
                                  key={channel.value}
                                  type="button"
                                  onClick={() => {
                                    setSelectedChannel(channel.value);
                                    setCheckoutStep("detail");
                                  }}
                                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${active ? "border-[#0667ff] bg-blue-50/60 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200"}`}
                                >
                                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100">{methodIcon(channel.label)}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-[#0a2254]">{channel.label}</span>
                                    <span className="mt-0.5 block text-xs text-slate-600">{channel.hint}</span>
                                  </span>
                                  {active ? (
                                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0667ff] text-white">✓</span>
                                  ) : (
                                    <ChevronRight size={18} className="text-slate-400" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCheckoutStep("choose")}
                        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0667ff] hover:underline"
                      >
                        <X size={14} />
                        Tutup
                      </button>
                      <h1 className="text-xl font-black text-[#0a2254]">{selectedChannelMeta?.label || "Metode Pembayaran"}</h1>
                      <p className="mt-1 text-xs text-slate-600">
                        {isQris && "Scan kode QR di bawah menggunakan aplikasi pembayaran Anda."}
                        {isCard && "Isi detail kartu Anda dengan aman."}
                        {isWallet && "Selesaikan pembayaran dari aplikasi dompet digital Anda."}
                        {(isTransfer || isVA) && "Pilih bank tujuan dan ikuti instruksi pembayaran."}
                      </p>

                      {(isTransfer || isVA) && (
                        <div className="mt-4 space-y-3">
                          {selectedChannel.endsWith("-va") && vaBankChannels.length ? (
                            <div>
                              <p className="mb-2 text-sm font-bold text-[#0a2254]">Pilih Bank Tujuan</p>
                              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                                {vaBankChannels.map((bank) => (
                                  <button
                                    key={bank.value}
                                    type="button"
                                    onClick={() => setSelectedVaBank(bank.value)}
                                    className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold ${
                                      selectedVaBank === bank.value
                                        ? "border-[#0667ff] bg-blue-50 text-[#0667ff]"
                                        : "border-slate-200 bg-white text-slate-600"
                                    }`}
                                  >
                                    {getBankVisual(bank.value, bank.label).logo ? (
                                      <img
                                        src={getBankVisual(bank.value, bank.label).logo}
                                        alt={getBankVisual(bank.value, bank.label).alt}
                                        className="h-4 w-auto object-contain"
                                      />
                                    ) : (
                                      <span>{getBankVisual(bank.value, bank.label).short}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="rounded-xl border border-[#8cb8ff] bg-blue-50/60 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-[#0a4ecf]">
                                      {(() => {
                                        const selected = vaBankChannels.find((bank) => bank.value === selectedVaBank);
                                        const visual = getBankVisual(selected?.value, selected?.label);
                                        return visual.logo ? (
                                          <img src={visual.logo} alt={visual.alt} className="h-4 w-auto object-contain" />
                                        ) : (
                                          visual.short
                                        );
                                      })()}
                                    </span>
                                    <div>
                                      <p className="text-sm font-bold text-[#0a2254]">
                                        {vaBankChannels.find((bank) => bank.value === selectedVaBank)?.label || "Virtual Account"}
                                      </p>
                                      <p className="text-xs text-slate-600">Biaya admin: Rp 0</p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-700">Rekomendasi</span>
                                </div>
                              </div>
                            </div>
                          ) : null}

                        </div>
                      )}

                      {isCard && (
                        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <label className="block text-sm font-semibold text-[#0a2254]">Nomor Kartu
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="1234 5678 9012 3456" />
                          </label>
                          <label className="block text-sm font-semibold text-[#0a2254]">Nama pada Kartu
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Nama sesuai kartu" />
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block text-sm font-semibold text-[#0a2254]">Masa Berlaku
                              <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="MM / YY" />
                            </label>
                            <label className="block text-sm font-semibold text-[#0a2254]">CVV
                              <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="123" />
                            </label>
                          </div>
                        </div>
                      )}

                      {isQris && (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                            <p className="text-sm font-bold text-[#0a2254]">QRIS <span className="font-medium text-slate-500">- QR Code Standar Pembayaran Nasional</span></p>
                            <div className="mx-auto mt-3 grid h-[220px] w-[220px] place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                              QR akan tampil setelah transaksi dibuat
                            </div>
                            <p className="mt-2 text-xs font-bold text-[#0667ff]">QRIS ID: 93600 2024 0520 00123</p>
                          </div>
                        </div>
                      )}

                      {selectedChannel.endsWith("-ewallet") && ewalletChannels.length ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-2 text-sm font-bold text-[#0a2254]">Pilih E-Wallet</p>
                          <div className="grid grid-cols-2 gap-2">
                            {ewalletChannels.map((wallet) => (
                              <button
                                key={wallet.value}
                                type="button"
                                onClick={() => setSelectedEwallet(wallet.value)}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                                  selectedEwallet === wallet.value
                                    ? "border-[#0667ff] bg-blue-50 text-[#0667ff]"
                                    : "border-slate-200 bg-white text-slate-600"
                                }`}
                              >
                                {wallet.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {isWallet && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
                            <div className="grid h-[170px] w-[170px] place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                              QR e-wallet dari iPaymu
                            </div>
                            <div>
                              <p className="font-bold text-[#0a2254]">{isGopay ? "Scan QR di aplikasi GoPay" : isShopee ? "Scan QR di aplikasi ShopeePay" : "Scan QR di aplikasi e-wallet"}</p>
                              <p className="mt-1 text-sm text-slate-600">Buka aplikasi lalu pindai QR untuk melanjutkan pembayaran.</p>
                              <p className="mt-2 text-sm font-semibold text-[#0a2254]">Nomor HP: 0812 3456 7890</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedChannel.endsWith("-retail") && retailChannels.length ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-2 text-sm font-bold text-[#0a2254]">Pilih Retail</p>
                          <div className="grid grid-cols-2 gap-2">
                            {retailChannels.map((retail) => (
                              <button
                                key={retail.value}
                                type="button"
                                onClick={() => setSelectedRetail(retail.value)}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                                  selectedRetail === retail.value
                                    ? "border-[#0667ff] bg-blue-50 text-[#0667ff]"
                                    : "border-slate-200 bg-white text-slate-600"
                                }`}
                              >
                                {getRetailVisual(retail.value, retail.label).logo ? (
                                  <img
                                    src={getRetailVisual(retail.value, retail.label).logo}
                                    alt={getRetailVisual(retail.value, retail.label).alt}
                                    className="mx-auto h-4 w-auto object-contain"
                                  />
                                ) : (
                                  retail.label
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>

                <aside className="space-y-2.5 p-3 sm:p-4">
                  <h2 className="text-lg font-black text-[#0a2254]">Informasi Pembayaran</h2>
                  <section className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-bold text-[#0a2254]/80">Total Pembayaran</p>
                    <h3 className="mt-1 text-3xl font-black tracking-tight text-[#0667ff]">{formatCurrency(totalPayment)}</h3>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Order ID</span>
                      <button type="button" className="inline-flex items-center gap-2 font-semibold text-[#0a2254] hover:text-[#0667ff]">
                        INV-{new Date().toISOString().slice(0, 10).replaceAll("-", "")}-{selectedBills.length}
                        <Copy size={14} />
                      </button>
                    </div>
                  </section>

                  {!gatewayEnabled && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Payment gateway sedang dinonaktifkan admin. Silakan kembali dan gunakan pembayaran manual.
                    </div>
                  )}

                  <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                    <p className="mb-2 font-bold text-[#0a2254]">Ringkasan Pesanan</p>
                    <div className="space-y-1 text-slate-700">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totalPayment)}</span></div>
                      <div className="flex justify-between"><span>Biaya Layanan</span><span>{formatCurrency(0)}</span></div>
                      <div className="mt-2 border-t border-slate-200 pt-2 font-bold text-[#0667ff] flex justify-between"><span>Total Pembayaran</span><span>{formatCurrency(totalPayment)}</span></div>
                    </div>
                  </section>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[#0a2254]">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="mt-0.5 text-[#0667ff]" />
                      <span>Setelah klik tombol aksi, Anda akan diarahkan ke proses pembayaran.</span>
                    </div>
                  </div>
                  {checkoutStep === "detail" ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0667ff] px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(6,103,255,.25)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedBills.length || busy || !gatewayEnabled || !selectedChannelMeta}
                      onClick={() => {
                        let channelToPay = selectedChannelMeta.value;
                        if (channelToPay.endsWith("-va")) {
                          channelToPay = selectedVaBank || vaBankChannels[0]?.value || (gatewayProviderKey === "tripay" ? "tripay-va-bri" : "ipaymu-va-bri");
                        }
                      if (channelToPay.endsWith("-retail")) {
                        channelToPay = selectedRetail || retailChannels[0]?.value || (gatewayProviderKey === "tripay" ? "tripay-retail-alfamart" : "ipaymu-cstore-alfamart");
                      }
                      if (channelToPay.endsWith("-ewallet")) {
                        channelToPay = selectedEwallet || ewalletChannels[0]?.value || (gatewayProviderKey === "tripay" ? "tripay-ewallet-ovo" : "ipaymu-ewallet-gopay");
                      }
                      pay(channelToPay);
                    }}
                  >
                      <Lock size={18} />
                      {busy ? "Memproses..." : actionButtonLabel}
                    </button>
                  ) : null}
                  {gatewayRejection ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                      <p className="font-semibold">{gatewayRejection}</p>
                      <div className="mt-2 grid gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left font-semibold hover:bg-amber-100"
                          onClick={() => {
                            setCheckoutStep("choose");
                            setGatewayRejection("");
                          }}
                        >
                          Pilih Metode Lain
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left font-semibold hover:bg-amber-100"
                          onClick={() => navigate(`/orang-tua/tagihan/pembayaran/manual?bill_ids=${requestedBillIds.join(",")}`)}
                        >
                          Bayar Manual
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left font-semibold hover:bg-amber-100"
                          onClick={() => navigate("/orang-tua/notifikasi")}
                        >
                          Hubungi Admin
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <p className="text-center text-[11px] text-slate-500">
                    <ShieldCheck size={14} className="mr-1 inline-block" />
                    Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan
                  </p>
                </aside>
              </main>
            </div>
          </div>
        </section>
      </div>

      <ModalFrame
        open={Boolean(gatewayPopupData)}
        title="Pembayaran Gateway"
        description="Selesaikan pembayaran dari detail berikut."
        maxWidthClass="max-w-2xl"
        showIcon={false}
        showHeader={false}
        cardClassName="max-h-[100dvh] overflow-hidden rounded-none p-0 sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl"
        onClose={() => setGatewayPopupData(null)}
      >
        {gatewayPopupData ? (() => {
          const popupProvider = String(gatewayPopupData.popup_provider || "").toLowerCase();
          const providerTitle = popupProvider === "tripay" ? "Tripay" : "iPaymu Direct";
          const popupPayment = gatewayPopupData.popup_payment || {};
          const transactionUrl = gatewayPopupData.reference_no
            ? `/orang-tua/transaksi?gateway=${encodeURIComponent(popupProvider || "gateway")}&ref=${encodeURIComponent(gatewayPopupData.reference_no)}`
            : "/orang-tua/transaksi";
          const summarySubtotal = popupPayment.subtotal || gatewayPopupData.total_amount || 0;
          const summaryFee = popupPayment.fee || 0;
          const summaryTotal = popupPayment.total || gatewayPopupData.total_amount || 0;
          const summaryMethod = popupPayment.payment_name || popupPayment.payment_method || providerTitle;
          const summaryMethodKey = String(summaryMethod || "").toLowerCase();
          const paymentNumberLabel = summaryMethodKey.includes("virtual") || summaryMethodKey.includes("va")
            ? "Nomor Virtual Account"
            : summaryMethodKey.includes("alfamart") || summaryMethodKey.includes("indomaret") || summaryMethodKey.includes("retail") || summaryMethodKey.includes("cstore")
              ? "Kode Pembayaran"
              : "Nomor Pembayaran";

          return (
            <div className="flex max-h-[100dvh] flex-col sm:max-h-[calc(100vh-2rem)]">
              <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#0a2254]">Pembayaran {providerTitle}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Selesaikan pembayaran dari detail berikut.</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    onClick={() => setGatewayPopupData(null)}
                    aria-label="Tutup popup pembayaran"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#061d4a] via-[#082b6f] to-[#061d4a] px-3.5 py-3 text-white shadow-[0_12px_30px_rgba(6,29,74,0.26)]">
                    <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-white/70">Total Pembayaran</p>
                    <p className="mt-1 text-[1.7rem] font-black tracking-tight text-[#8ec2ff] sm:text-3xl">{formatCurrency(summaryTotal)}</p>
                    <div className="mt-2 h-px bg-white/20" />
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
                      <span className="text-white/75">Subtotal <span className="font-semibold text-white">{formatCurrency(summarySubtotal)}</span></span>
                      <span className="text-white/75">Biaya <span className="font-semibold text-white">{formatCurrency(summaryFee)}</span></span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="grid gap-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">Metode</span>
                        <span className="font-semibold text-slate-900">{summaryMethod}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">Batas Waktu</span>
                        <span className="font-semibold text-slate-900">{popupPayment.expired_at ? formatDate(popupPayment.expired_at) : "-"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">Ref</span>
                        <span className="font-mono text-slate-900">{gatewayPopupData.reference_no || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {popupPayment.qr_image ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-2.5 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Scan QRIS</p>
                      <img
                        src={popupPayment.qr_image}
                        alt={`QR ${providerTitle}`}
                        className="mx-auto mt-2 w-full max-w-[220px] rounded-xl border border-emerald-200 bg-white p-2 sm:max-w-[280px]"
                      />
                    </div>
                  ) : null}

                  {popupPayment.payment_number ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{paymentNumberLabel}</p>
                      <p className="mt-2 break-all rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-sm text-white">{popupPayment.payment_number}</p>
                    </div>
                  ) : null}

                  {!popupPayment.qr_image && popupPayment.qr_string ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR String</p>
                      <p className="mt-2 break-all font-mono text-xs text-slate-700">{popupPayment.qr_string}</p>
                    </div>
                  ) : null}

                  {Array.isArray(popupPayment.instructions) && popupPayment.instructions.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instruksi Pembayaran</p>
                      <div className="mt-3 space-y-3">
                        {popupPayment.instructions.map((instruction, index) => (
                          <div key={`${instruction.title || "langkah"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-sm font-bold text-[#0a2254]">{instruction.title || `Panduan ${index + 1}`}</p>
                            <ol className="mt-2 space-y-1.5 text-xs text-slate-700">
                              {(instruction.steps || []).map((step, stepIndex) => (
                                <li key={`${index}-${stepIndex}`} className="flex gap-2">
                                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0667ff] text-[10px] font-bold text-white">
                                    {stepIndex + 1}
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
                    <div className="grid gap-1 text-[11px] text-slate-700 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-1">
                      <span>Setelah membayar, status transaksi akan otomatis diperbarui.</span>
                      <span className="font-semibold text-[#0667ff]">Ref: {gatewayPopupData.reference_no || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
                <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => setGatewayPopupData(null)}
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    className="btn-primary w-full sm:w-auto"
                    onClick={() => {
                      navigationBypassRef.current = true;
                      setAllowNavigation(true);
                      navigate(transactionUrl);
                    }}
                  >
                    Lihat Riwayat
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </ModalFrame>
    </div>
  );
}
