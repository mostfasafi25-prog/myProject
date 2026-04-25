import React, { useState, useEffect } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Snackbar,
  Menu,
  Fade,
  TablePagination,
  Grid,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import DateRangeIcon from "@mui/icons-material/DateRange";
import PersonIcon from "@mui/icons-material/Person";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PaidIcon from "@mui/icons-material/Paid";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import axios from "axios";
import { confirmApp } from "../../../utils/appToast";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const CUSTOMERS_URL = `${API_BASE_URL}/customers`;
const PAY_SALARY_URL = `${API_BASE_URL}/treasury/pay-salary`;

const Customers = () => {
  // ===== الحالات الأساسية =====
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  // ===== حالات التقرير =====
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [filters, setFilters] = useState({
    employee_id: "",
    department: "",
    start_date: null,
    end_date: null,
    payment_method: "",
    month: "", // أضف هذا للحصول على فلتر الشهر
  });
  const fetchReport = async () => {
    try {
      setReportLoading(true);
      setReportError(null);
      setShowReport(true); // تأكد من عرض التقرير

      // تحضير الباراميترات
      const params = {
        ...filters,
        start_date: filters.start_date
          ? new Date(filters.start_date).toISOString().split("T")[0]
          : null,
        end_date: filters.end_date
          ? new Date(filters.end_date).toISOString().split("T")[0]
          : null,
      };

      // إزالة القيم الفارغة
      Object.keys(params).forEach((key) => {
        if (!params[key] || params[key] === "") {
          delete params[key];
        }
      });


      const response = await axios.get(
        `${API_BASE_URL}/treasury/employee-payments-report`,
        { params },
      );

      if (response.data.success) {
        setReportData(response.data.data);
        showSnackbar("تم جلب التقرير بنجاح", "success");
      } else {
        setReportError(response.data.message || "حدث خطأ في جلب التقرير");
        showSnackbar("خطأ في جلب التقرير", "error");
      }
    } catch (err) {
      console.error("خطأ في جلب التقرير:", err);
      setReportError(err.response?.data?.message || "تعذر جلب التقرير");
      showSnackbar("تعذر جلب التقرير", "error");
    } finally {
      setReportLoading(false);
    }
  };

  // ===== تصدير التقرير إلى CSV =====
  const handleExportCSV = () => {
    if (!reportData) return;

    const csvContent = [
      ["تقرير مدفوعات الموظفين", "", "", "", ""],
      ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA"), "", "", ""],
      ["", "", "", "", ""],
      [
        "إجمالي المبالغ",
        reportData.summary.total_payments,
        "عدد المدفوعات",
        reportData.summary.payments_count,
        "عدد الموظفين",
        reportData.summary.employees_count,
      ],
      ["", "", "", "", ""],
      [
        "التاريخ",
        "رقم العملية",
        "الموظف",
        "القسم",
        "المبلغ",
        "طريقة الدفع",
        "ملاحظات",
      ],
      ...reportData.detailed_payments.map((payment) => [
        payment.transaction_date,
        payment.transaction_number,
        payment.employee_name,
        payment.employee_department,
        payment.amount,
        payment.payment_method,
        payment.notes || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `تقرير_مدفوعات_الموظفين_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSnackbar("تم تصدير التقرير بنجاح", "success");
  };

  // ===== طباعة التقرير =====
  const handlePrint = () => {
    window.print();
  };

  // ===== معالجة تغيير الفلاتر =====
  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ===== إعادة تعيين الفلاتر =====
  const [sortOrder, setSortOrder] = useState("desc"); // أو "asc"

  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // ===== حالات المودال =====
  const [openDialog, setOpenDialog] = useState(false);
  const [openSalaryDialog, setOpenSalaryDialog] = useState(false);
  const [openAllSalariesDialog, setOpenAllSalariesDialog] = useState(false);
  const handleShowEmployeeReport = (employee) => {
    // تعيين فلتر الموظف
    setFilters({
      employee_id: employee.id,
      department: "",
      start_date: null,
      end_date: null,
      payment_method: "",
      month: "",
    });

    // جلب التقرير
    fetchReport();

    // عرض رسالة للمستخدم
    showSnackbar(`جاري تحميل تقرير ${employee.name}...`, "info");
  };

  // ===== إعادة تعيين الفلاتر =====
  const handleResetFilters = () => {
    setFilters({
      employee_id: "",
      department: "",
      start_date: null,
      end_date: null,
      payment_method: "",
      month: "",
    });
    fetchReport(); // إعادة جلب التقرير مع الفلاتر الجديدة
  };
  // تصدير التقرير
  const handleExport = () => {
    if (!reportData) return;

    const csvContent = [
      ["تقرير تقبض العاملين", "", "", "", ""],
      ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA"), "", "", ""],
      ["", "", "", "", ""],
      [
        "إجمالي المبالغ",
        reportData.summary.total_payments,
        "عدد المدفوعات",
        reportData.summary.payments_count,
        "عدد الموظفين",
        reportData.summary.employees_count,
      ],
      ["", "", "", "", ""],
      [
        "التاريخ",
        "رقم العملية",
        "الموظف",
        "القسم",
        "المبلغ",
        "الطريقة",
        "ملاحظات",
      ],
      ...reportData.detailed_payments.map((payment) => [
        payment.transaction_date,
        payment.transaction_number,
        payment.employee_name,
        payment.employee_department,
        payment.amount,
        payment.payment_method,
        payment.notes || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `تقرير_تقبض_العاملين_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    department: "",
    salary: "",
    shift: "",
    phone: "",
    role: "user", // ⬅️ أضف هذا هنا
    payment_type: "monthly", // ⬅️ أضف هذا
    daily_rate: "", // ⬅️ أضف هذا
  });
  const [salaryData, setSalaryData] = useState({
    employee_id: "",
    month: "",
    amount: "",
    notes: "",
  });
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errors, setErrors] = useState({});

  // ===== حالات التنبيهات =====
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // ===== حالات القوائم =====
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // ===== خيارات القوائم المنسدلة =====
  // ===== خيارات القوائم المنسدلة =====
  const departments = [
    { value: "مطبخ", label: "مطبخ" },
    { value: "كاشير", label: "كاشير" },
    { value: " طاولة", label: " طاولة" },
    { value: "تسييخ", label: "تسييخ" },
    { value: "مشتريات", label: "مشتريات" },
  ];

  const shifts = [
    { value: "صباحي", label: "صباحي" },
    { value: "مسائي", label: "مسائي" },
  ];

  // ===== توليد أشهر السنة =====
  const months = [];
  for (let i = 1; i <= 12; i++) {
    const month = i.toString().padStart(2, "0");
    const year = new Date().getFullYear();
    months.push({ value: `${year}-${month}`, label: `${year}-${month}` });
  }

  // ===== جلب البيانات =====
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await axios.get(CUSTOMERS_URL);

      if (response.data && response.data.success) {
        setEmployees(response.data.data || []);
        setFilteredEmployees(response.data.data || []);
      } else {
        setEmployees([]);
        setFilteredEmployees([]);
      }
    } catch (err) {
      console.error("خطأ في جلب البيانات:", err);
      setError("تعذر جلب بيانات الموظفين");
      showSnackbar("خطأ في جلب بيانات الموظفين", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // ===== فلترة البيانات =====
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const filtered = employees.filter((employee) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (employee.name && employee.name.toLowerCase().includes(searchLower)) ||
        (employee.department &&
          employee.department.toLowerCase().includes(searchLower)) ||
        (employee.phone && employee.phone.includes(searchTerm))
      );
    });

    setFilteredEmployees(filtered);
    setPage(0);
  }, [searchTerm, employees]);

  // ===== فتح وإغلاق المودال =====
  const handleOpenDialog = () => {
    setOpenDialog(true);
    setErrors({});
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewEmployee({
      name: "",
      department: "",
      salary: "",
      shift: "",
      phone: "",
      role: "user", // ⬅️ أضف هذا هنا أيضاً
      payment_type: "monthly", // ⬅️ أضف هذا
      daily_rate: "", // ⬅️ أضف هذا
    });
    setErrors({});
  };

  // ===== فتح مودال تقبيض موظف =====
  const handleOpenSalaryDialog = (employee) => {
    setSelectedEmployee(employee);
    setSalaryData({
      employee_id: employee.id,
      month: months[0]?.value || `${new Date().getFullYear()}-01`,
      amount: employee.salary || "",
      notes: `راتب ${employee.name}`,
    });
    setOpenSalaryDialog(true);
    setErrors({});
  };

  const handleCloseSalaryDialog = () => {
    setOpenSalaryDialog(false);
    setSalaryData({
      employee_id: "",
      month: "",
      amount: "",
      notes: "",
    });
    setErrors({});
  };

  // ===== فتح مودال تقبيض الكل =====
  const handleOpenAllSalariesDialog = () => {
    const totalSalary = employees.reduce(
      (sum, emp) => sum + (parseFloat(emp.salary) || 0),
      0,
    );
    setSalaryData({
      month: months[0]?.value || `${new Date().getFullYear()}-01`,
      amount: totalSalary.toFixed(2),
      notes: `رواتب جميع الموظفين`,
    });
    setOpenAllSalariesDialog(true);
    setErrors({});
  };

  const handleCloseAllSalariesDialog = () => {
    setOpenAllSalariesDialog(false);
    setSalaryData({
      month: "",
      amount: "",
      notes: "",
    });
    setErrors({});
  };

  // ===== عرض التنبيهات =====
  const showSnackbar = (message, severity = "success") => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  // ===== القائمة المنسدلة للمزيد =====
  const handleMenuOpen = (event, employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmployee(null);
  };

  // ===== التعامل مع إدخال البيانات =====
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee({
      ...newEmployee,
      [name]: value,
    });

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleSalaryInputChange = (e) => {
    const { name, value } = e.target;
    setSalaryData({
      ...salaryData,
      [name]: value,
    });

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  // ===== التحقق من البيانات =====
  const validateForm = () => {
    const newErrors = {};

    if (!newEmployee.name.trim()) {
      newErrors.name = "الاسم مطلوب";
    }

    if (!newEmployee.department) {
      newErrors.department = "القسم مطلوب";
    }

    if (!newEmployee.salary) {
      newErrors.salary = "الراتب مطلوب";
    } else if (
      isNaN(newEmployee.salary) ||
      parseFloat(newEmployee.salary) <= 0
    ) {
      newErrors.salary = "الراتب يجب أن يكون رقم صحيح";
    }

    if (!newEmployee.shift) {
      newErrors.shift = "المناوبة مطلوبة";
    }

    if (!newEmployee.phone) {
      newErrors.phone = "رقم الهاتف مطلوب";
    } else if (!/^[0-9]{10,15}$/.test(newEmployee.phone)) {
      newErrors.phone = "رقم هاتف غير صالح";
    }

    // ⬇️ احذف هذا الجزء بالكامل ⬇️
    // if (!newEmployee.role) {
    //   newErrors.role = "الدور مطلوب";
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSalaryForm = () => {
    const newErrors = {};

    if (!salaryData.month) {
      newErrors.month = "الشهر مطلوب";
    }

    if (!salaryData.amount) {
      newErrors.amount = "المبلغ مطلوب";
    } else if (isNaN(salaryData.amount) || parseFloat(salaryData.amount) <= 0) {
      newErrors.amount = "المبلغ يجب أن يكون رقم صحيح";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== إرسال البيانات للباكند =====
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoadingSubmit(true);

    try {
      const dataToSend = {
        name: newEmployee.name,
        department: newEmployee.department,
        salary: newEmployee.salary,
        shift: newEmployee.shift,
        phone: newEmployee.phone,
        role: "user",
        payment_type: newEmployee.payment_type, // ⬅️ أضف هذا
        daily_rate:
          newEmployee.payment_type === "daily" ? newEmployee.daily_rate : 0, // ⬅️ أضف هذا
      };


      const response = await axios.post(CUSTOMERS_URL, dataToSend);


      if (response.data.success) {
        handleCloseDialog();
        fetchEmployees();
        showSnackbar("تم إضافة الموظف بنجاح!", "success");
      } else {
        const errorMsg = response.data.message || "حدث خطأ أثناء الإضافة";
        setErrors({
          submit: errorMsg,
        });
        showSnackbar(errorMsg, "error");
      }
    } catch (err) {
      console.error("خطأ في الاتصال بالخادم:", {
        message: err.message,
        response: err.response,
        data: err.response?.data,
        status: err.response?.status,
      });

      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "فشل في إضافة الموظف";


      setErrors({
        submit: errorMsg,
      });
      showSnackbar(errorMsg, "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ===== تقبيض موظف واحد =====
  const handlePaySalary = async () => {
    if (!validateSalaryForm()) {
      return;
    }

    setLoadingSubmit(true);

    try {
      const response = await axios.post(PAY_SALARY_URL, {
        employee_id: salaryData.employee_id,
        month: salaryData.month,
        amount: salaryData.amount,
        notes: salaryData.notes,
      });

      if (response.data.success) {
        handleCloseSalaryDialog();
        fetchEmployees();
        showSnackbar("تم تقبيض الموظف بنجاح!", "success");

        // عرض تفاصيل العملية
        showSnackbar(
          `تم دفع ${response.data.data?.payment?.amount || salaryData.amount} شيكل للموظف ${selectedEmployee?.name}`,
          "success",
        );
      } else {
        setErrors({
          submit: response.data.message || "حدث خطأ أثناء التقبيض",
        });
      }
    } catch (err) {
      console.error("خطأ في التقبيض:", err);
      const errorMsg = err.response?.data?.message || "فشل في تقبيض الموظف";
      setErrors({
        submit: errorMsg,
      });
      showSnackbar(errorMsg, "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ===== تقبيض جميع الموظفين =====
  const handlePayAllSalaries = async () => {
    if (!validateSalaryForm()) {
      return;
    }

    setLoadingSubmit(true);

    try {
      // دفع رواتب كل موظف على حدة
      const promises = employees.map((employee) =>
        axios.post(PAY_SALARY_URL, {
          employee_id: employee.id,
          month: salaryData.month,
          amount: employee.salary,
          notes: `راتب ${employee.name} - ${salaryData.notes}`,
        }),
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.data.success);

      handleCloseAllSalariesDialog();
      fetchEmployees();

      if (successful.length === employees.length) {
        showSnackbar(`تم تقبيض جميع الموظفين بنجاح!`, "success");
      } else {
        showSnackbar(
          `تم تقبيض ${successful.length} من ${employees.length} موظف`,
          "warning",
        );
      }
    } catch (err) {
      console.error("خطأ في تقبيض الجميع:", err);
      const errorMsg = err.response?.data?.message || "فشل في تقبيض الموظفين";
      setErrors({
        submit: errorMsg,
      });
      showSnackbar(errorMsg, "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ===== دالة الحذف =====
  const handleDelete = async (id) => {
    const ok = await confirmApp({
      title: "حذف الموظف",
      text: "هل أنت متأكد من حذف هذا الموظف؟",
      icon: "warning",
      danger: true,
      confirmText: "نعم، احذف",
    });
    if (!ok) return;

    try {
      await axios.delete(`${CUSTOMERS_URL}/${id}`);
      fetchEmployees();
      showSnackbar("تم حذف الموظف بنجاح", "success");
    } catch (err) {
      console.error("خطأ في الحذف:", err);
      showSnackbar("فشل في حذف الموظف", "error");
    }
  };

  // ===== حالة التحميل =====
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>جاري تحميل البيانات...</Typography>
      </Box>
    );
  }

  // ===== حالة الخطأ =====
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* شريط البحث والإضافة */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 3,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <TextField
          placeholder="ابحث عن موظف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {/* تحديث هذا الجزء في شريط البحث والإضافة */}
        <Box sx={{ display: "flex", gap: 2 }}>
          {employees.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PaidIcon />}
              sx={{ bgcolor: "#4caf50" }}
              onClick={handleOpenAllSalariesDialog}
            >
              تقبيض الكل
            </Button>
          )}

          {/* أضف هذا الزر */}
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={fetchReport}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <CircularProgress size={20} sx={{ mr: 1 }} />
            ) : (
              "عرض تقرير المدفوعات"
            )}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ bgcolor: "#43c8ff" }}
            onClick={handleOpenDialog}
          >
            إضافة موظف جديد
          </Button>
        </Box>
      </Box>

      {/* ===== نافذة إضافة موظف (مودال) ===== */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">إضافة موظف جديد</Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="اسم الموظف"
              name="name"
              value={newEmployee.name}
              onChange={handleInputChange}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name}
              size="small"
            />

            <FormControl fullWidth size="small" error={!!errors.department}>
              <InputLabel>القسم</InputLabel>
              <Select
                name="department"
                value={newEmployee.department}
                onChange={handleInputChange}
                label="القسم"
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.department && (
                <Typography variant="caption" color="error">
                  {errors.department}
                </Typography>
              )}
            </FormControl>

            <TextField
              label="الراتب الشهري (شيكل)"
              name="salary"
              type="number"
              value={newEmployee.salary}
              onChange={handleInputChange}
              fullWidth
              required
              error={!!errors.salary}
              helperText={errors.salary}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">شيكل</InputAdornment>
                ),
              }}
            />

            <FormControl fullWidth size="small" error={!!errors.shift}>
              <InputLabel>المناوبة</InputLabel>
              <Select
                name="shift"
                value={newEmployee.shift}
                onChange={handleInputChange}
                label="المناوبة"
              >
                {shifts.map((shift) => (
                  <MenuItem key={shift.value} value={shift.value}>
                    {shift.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.shift && (
                <Typography variant="caption" color="error">
                  {errors.shift}
                </Typography>
              )}
            </FormControl>

            <TextField
              label="رقم الهاتف"
              name="phone"
              value={newEmployee.phone}
              onChange={handleInputChange}
              fullWidth
              required
              error={!!errors.phone}
              helperText={errors.phone}
              size="small"
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            sx={{ bgcolor: "#43c8ff" }}
            disabled={loadingSubmit}
          >
            {loadingSubmit ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "إضافة الموظف"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== نافذة تقبيض موظف ===== */}
      <Dialog
        open={openSalaryDialog}
        onClose={handleCloseSalaryDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              تقبيض الموظف: {selectedEmployee?.name}
            </Typography>
            <IconButton onClick={handleCloseSalaryDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="الموظف"
              value={
                selectedEmployee
                  ? `${selectedEmployee.name} - ${selectedEmployee.department}`
                  : ""
              }
              fullWidth
              size="small"
              disabled
            />

            <TextField
              label="الراتب الحالي"
              value={
                selectedEmployee?.salary
                  ? `${selectedEmployee.salary} شيكل`
                  : ""
              }
              fullWidth
              size="small"
              disabled
            />

            <FormControl fullWidth size="small" error={!!errors.month}>
              <InputLabel>الشهر</InputLabel>
              <Select
                name="month"
                value={salaryData.month}
                onChange={handleSalaryInputChange}
                label="الشهر"
              >
                {months.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.month && (
                <Typography variant="caption" color="error">
                  {errors.month}
                </Typography>
              )}
            </FormControl>

            <TextField
              label="المبلغ (شيكل)"
              name="amount"
              type="number"
              value={salaryData.amount}
              onChange={handleSalaryInputChange}
              fullWidth
              required
              error={!!errors.amount}
              helperText={errors.amount}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">شيكل</InputAdornment>
                ),
              }}
            />

            <TextField
              label="ملاحظات"
              name="notes"
              value={salaryData.notes}
              onChange={handleSalaryInputChange}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseSalaryDialog} color="inherit">
            إلغاء
          </Button>
          <Button
            onClick={handlePaySalary}
            variant="contained"
            startIcon={<AttachMoneyIcon />}
            sx={{ bgcolor: "#4caf50" }}
            disabled={loadingSubmit}
          >
            {loadingSubmit ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "تقبيض الموظف"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== نافذة تقبيض جميع الموظفين ===== */}
      <Dialog
        open={openAllSalariesDialog}
        onClose={handleCloseAllSalariesDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">تقبيض جميع الموظفين</Typography>
            <IconButton onClick={handleCloseAllSalariesDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              عدد الموظفين: <strong>{employees.length}</strong>
            </Typography>

            <Typography variant="body2" color="text.secondary">
              إجمالي الرواتب:{" "}
              <strong>
                {parseFloat(salaryData.amount).toLocaleString()} شيكل
              </strong>
            </Typography>

            <FormControl fullWidth size="small" error={!!errors.month}>
              <InputLabel>الشهر</InputLabel>
              <Select
                name="month"
                value={salaryData.month}
                onChange={handleSalaryInputChange}
                label="الشهر"
              >
                {months.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.month && (
                <Typography variant="caption" color="error">
                  {errors.month}
                </Typography>
              )}
            </FormControl>

            <TextField
              label="إجمالي المبلغ (شيكل)"
              name="amount"
              type="number"
              value={salaryData.amount}
              onChange={handleSalaryInputChange}
              fullWidth
              required
              error={!!errors.amount}
              helperText={errors.amount}
              size="small"
              disabled
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">شيكل</InputAdornment>
                ),
              }}
            />

            <TextField
              label="ملاحظات"
              name="notes"
              value={salaryData.notes}
              onChange={handleSalaryInputChange}
              fullWidth
              multiline
              rows={2}
              size="small"
            />

            <Alert severity="info" sx={{ mt: 1 }}>
              سيتم تقبيض جميع الموظفين البالغ عددهم {employees.length} موظف
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseAllSalariesDialog} color="inherit">
            إلغاء
          </Button>
          <Button
            onClick={handlePayAllSalaries}
            variant="contained"
            startIcon={<PaidIcon />}
            sx={{ bgcolor: "#4caf50" }}
            disabled={loadingSubmit}
          >
            {loadingSubmit ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "تقبيض جميع الموظفين"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== القائمة المنسدلة للمزيد ===== */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        TransitionComponent={Fade}
      >
        <MenuItem
          onClick={() => {
            handleOpenSalaryDialog(selectedEmployee);
            handleMenuClose();
          }}
        >
          <AttachMoneyIcon sx={{ mr: 1, fontSize: 20 }} />
          تقبيض الموظف
        </MenuItem>
        <MenuItem
          onClick={() => {
            // Add edit functionality here
            handleMenuClose();
          }}
        >
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          تعديل
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleDelete(selectedEmployee.id);
            handleMenuClose();
          }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          حذف
        </MenuItem>
      </Menu>

      {/* ===== عرض البيانات ===== */}
      {filteredEmployees.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {searchTerm ? "لا توجد نتائج للبحث" : "لا يوجد موظفين لعرضهم"}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table>
              <TableHead sx={{ backgroundColor: "#29b6f6" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>#</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>الموظف</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>القسم</TableCell>{" "}
                  <TableCell sx={{ fontWeight: "bold" }}>الراتب</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>المناوبة</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>الهاتف</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>الإجراءات</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredEmployees
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((employee, index) => (
                    <TableRow key={employee.id || index} hover>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {employee.name || "غير معروف"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.department || "غير محدد"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" color="primary">
                          {parseFloat(employee.salary || 0).toLocaleString()}{" "}
                          شيكل
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={employee.shift || "غير محدد"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{employee.phone || "غير محدد"}</TableCell>
                      <TableCell>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, employee)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={filteredEmployees.length}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
              labelRowsPerPage="عدد الصفوف:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} من ${count}`
              }
            />
          </TableContainer>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            عرض {Math.min(filteredEmployees.length, rowsPerPage)} من{" "}
            {filteredEmployees.length} موظف
          </Typography>
        </>
      )}

      {/* ===== التنبيهات ===== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      {/* ===== فلاتر التقرير ===== */}
      {/* ===== فلاتر وتقرير المدفوعات ===== */}
      {showReport && (
        <>
          {/* عرض التقرير إذا كان هناك بيانات */}
          {reportData && (
            <Paper
              sx={{
                mb: 4,
                p: 3,
                borderRadius: 2,
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                border: "1px solid #e3e3e3",
              }}
            >
              {/* شريط عنوان التقرير */}

              {/* فلاتر التقرير */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 3,
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    فلاتر التقرير
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    onClick={handleResetFilters}
                  >
                    إعادة تعيين
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={fetchReport}
                    disabled={reportLoading}
                    startIcon={
                      reportLoading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <FilterListIcon />
                      )
                    }
                    sx={{
                      bgcolor: "#1976d2",
                      "&:hover": { bgcolor: "#1565c0" },
                    }}
                  >
                    تطبيق الفلاتر
                  </Button>
                </Box>
              </Box>

              <Grid container spacing={2}>
                {/* فلتر الموظف */}
                <Grid size={{ xs: 12, md: 2, sm: 6 }}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>الموظف</InputLabel>
                    <Select
                      value={filters.employee_id}
                      onChange={(e) =>
                        handleFilterChange("employee_id", e.target.value)
                      }
                      label="الموظف"
                    >
                      <MenuItem value="">جميع الموظفين</MenuItem>
                      {employees.map((employee) => (
                        <MenuItem key={employee.id} value={employee.id}>
                          {employee.name} - {employee.department}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* فلتر القسم */}
                <Grid size={{ xs: 12, md: 2, sm: 6 }}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>القسم</InputLabel>
                    <Select
                      value={filters.department}
                      onChange={(e) =>
                        handleFilterChange("department", e.target.value)
                      }
                      label="القسم"
                    >
                      <MenuItem value="">جميع الأقسام</MenuItem>
                      {departments.map((dept) => (
                        <MenuItem key={dept.value} value={dept.value}>
                          {dept.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* فلتر الشهر */}
                <Grid size={{ xs: 12, md: 2, sm: 6 }}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>الشهر</InputLabel>
                    <Select
                      value={filters.month}
                      onChange={(e) =>
                        handleFilterChange("month", e.target.value)
                      }
                      label="الشهر"
                    >
                      <MenuItem value="">جميع الأشهر</MenuItem>
                      {months.map((month) => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* فلتر التاريخ من */}
                <Grid size={{ xs: 12, md: 2, sm: 6 }}>
                  <TextField
                    label="من تاريخ"
                    type="date"
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={filters.start_date || ""}
                    onChange={(e) =>
                      handleFilterChange("start_date", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* فلتر التاريخ إلى */}
                <Grid size={{ xs: 12, md: 2, sm: 6 }}>
                  <TextField
                    label="إلى تاريخ"
                    type="date"
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={filters.end_date || ""}
                    onChange={(e) =>
                      handleFilterChange("end_date", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>

              {/* إحصائيات سريعة */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ my: 4, color: "#d2c7c7" }}>
                  الإحصائيات الرئيسية
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 3, sm: 6 }}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        height: "100%",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <AttachMoneyIcon sx={{ color: "#4caf50", mr: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          إجمالي المبالغ
                        </Typography>
                      </Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#2e7d32"
                      >
                        {reportData.summary.total_payments.toLocaleString()}{" "}
                        شيكل
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 3, sm: 6 }}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        height: "100%",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <FilterListIcon sx={{ color: "#2196f3", mr: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          عدد المدفوعات
                        </Typography>
                      </Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#1976d2"
                      >
                        {reportData.summary.payments_count}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 3, sm: 6 }}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        height: "100%",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <PersonIcon sx={{ color: "#ff9800", mr: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          عدد الموظفين
                        </Typography>
                      </Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#ff9800"
                      >
                        {reportData.summary.employees_count}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 3, sm: 6 }}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        height: "100%",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <TrendingUpIcon sx={{ color: "#9c27b0", mr: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          متوسط المدفوع
                        </Typography>
                      </Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#9c27b0"
                      >
                        {reportData.summary.avg_payment.toFixed(2)} شيكل
                      </Typography>
                    </Paper>
                  </Grid>
                  {reportData.additional_stats && (
                    <>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Paper
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px solid #e0e0e0",
                            height: "100%",
                          }}
                        >
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              أعلى دفعة
                            </Typography>
                            <Chip
                              label={`${reportData.additional_stats.highest_payment || "0.00"} شيكل`}
                              color="success"
                              size="medium"
                              sx={{ fontSize: "1rem", fontWeight: "bold" }}
                            />
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Paper
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px solid #e0e0e0",
                            height: "100%",
                          }}
                        >
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              أقل دفعة
                            </Typography>
                            <Chip
                              label={`${reportData.additional_stats.lowest_payment || "0.00"} شيكل`}
                              color="warning"
                              size="medium"
                              sx={{ fontSize: "1rem", fontWeight: "bold" }}
                            />
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid size={{ xs: 12, md: 4 }}>
                        <Paper
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px solid #e0e0e0",
                            height: "100%",
                          }}
                        >
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              يوم الدفع الأكثر تكراراً
                            </Typography>
                            <Chip
                              label={
                                reportData.additional_stats
                                  .most_frequent_payment_day || "غير محدد"
                              }
                              color="info"
                              size="medium"
                              sx={{ fontSize: "1rem", fontWeight: "bold" }}
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>

              {/* تفاصيل المدفوعات */}
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" color="#333">
                    تفاصيل المدفوعات
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      عدد السجلات: {reportData.detailed_payments.length}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<FilterListIcon />}
                      onClick={() =>
                        setSortOrder((prev) =>
                          prev === "desc" ? "asc" : "desc",
                        )
                      }
                    >
                      {sortOrder === "desc" ? "الأحدث أولاً" : "الأقدم أولاً"}
                    </Button>
                  </Box>
                </Box>

                {reportData.detailed_payments.length > 0 ? (
                  <TableContainer
                    component={Paper}
                    sx={{
                      borderRadius: 2,
                      border: "1px solid #e0e0e0",
                      overflow: "hidden",
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {" "}
                          <TableCell
                            sx={{ fontWeight: "bold", color: "white" }}
                          >
                            اسم العامل
                          </TableCell>
                          <TableCell
                            sx={{ fontWeight: "bold", color: "white" }}
                          >
                            استلم راتبه بتاريخ
                          </TableCell>
                          <TableCell
                            sx={{ fontWeight: "bold", color: "white" }}
                          >
                            القسم
                          </TableCell>
                          <TableCell
                            sx={{ fontWeight: "bold", color: "white" }}
                          >
                            المبلغ
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reportData.detailed_payments
                          .sort((a, b) => {
                            const dateA = new Date(a.transaction_date);
                            const dateB = new Date(b.transaction_date);
                            return sortOrder === "desc"
                              ? dateB - dateA
                              : dateA - dateB;
                          })
                          .map((payment, index) => (
                            <TableRow
                              key={index}
                              hover
                              sx={{
                                "&:hover": { bgcolor: "#f0f0f0" },
                              }}
                            >
                              {" "}
                              <TableCell>
                                <Typography fontWeight="medium">
                                  {payment.employee_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(
                                    payment.transaction_date,
                                  ).toLocaleDateString("ar-SA")}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={payment.employee_department}
                                  size="small"
                                  color="default"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography fontWeight="bold" color="primary">
                                  {parseFloat(payment.amount).toLocaleString()}{" "}
                                  شيكل
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Paper
                    sx={{
                      p: 4,
                      textAlign: "center",
                      borderRadius: 2,
                      border: "1px dashed #ddd",
                    }}
                  >
                    <FilterListIcon
                      sx={{ fontSize: 48, color: "#ccc", mb: 2 }}
                    />
                    <Typography color="text.secondary">
                      لا توجد مدفوعات لعرضها بناءً على الفلاتر المحددة
                    </Typography>
                  </Paper>
                )}
              </Box>

              {/* معلومات التقرير */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 4,
                  pt: 2,
                  borderTop: "1px solid #eaeaea",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  تم إنشاء التقرير في: {new Date().toLocaleString("ar-SA")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  النظام: تقرير مدفوعات الموظفين
                </Typography>
              </Box>
            </Paper>
          )}

          {/* رسالة تحميل */}
          {reportLoading && (
            <Paper
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: 2,
                border: "1px solid #e0e0e0",
                mb: 4,
              }}
            >
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body1" color="primary">
                جاري تحميل التقرير...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                الرجاء الانتظار
              </Typography>
            </Paper>
          )}

          {/* رسالة خطأ */}
          {reportError && (
            <Paper
              sx={{
                p: 3,
                borderRadius: 2,
                border: "1px solid #ffcdd2",
                mb: 4,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <CloseIcon sx={{ color: "#f44336", mr: 1 }} />
                <Typography variant="h6" color="error">
                  خطأ في جلب التقرير
                </Typography>
              </Box>
              <Typography color="error">{reportError}</Typography>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={fetchReport}
                sx={{ mt: 2 }}
              >
                إعادة المحاولة
              </Button>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default Customers;
