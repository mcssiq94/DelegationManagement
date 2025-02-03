import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import Select from 'react-select';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Plus, Edit, Trash, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import api from "../../services/axiosConfig";
import { Menu, MenuItem } from '@mui/material';
import Swal from 'sweetalert2';
import _ from 'lodash';
import { useToast } from "../ui/use-toast";
import GroupedDelegationsTable from './GroupedDelegationsTable';
import { 
  FileUp,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  RefreshCw
  } from 'lucide-react';
  import DatePicker from 'react-datepicker';
  import "react-datepicker/dist/react-datepicker.css";

const DelegationManagement = () => {
  const [delegations, setDelegations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState(null); // لتحديد العنصر المفتوح
  const [selectedDelegation, setSelectedDelegation] = useState(null); // لتحديد الإيفاد المحدد
  const [userRoles, setUserRoles] = useState([]);
  const isAdminOrHRAdmin = userRoles.includes('Admin') || userRoles.includes('HRAdmin');
  const [secondaryIdOptions, setSecondaryIdOptions] = useState([]);
  const [lastSecondaryId, setLastSecondaryId] = useState(null);
  
  // تجميع الايفادات حسب المعرف الثانوي
  //const groupedDelegations = _.groupBy(delegations, 'secondaryId');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    delegationType: '',
    employeeNumber: '',
    employeeName: '',
    jobTitle: '',
    department: '',
    letterNumber: '',
    letterFile: null,
    letterDate: '', // تنسيق التاريخ كنص
    disengagementDate: '',
    disengagementLetterDate: '',
    travelDate: '',
    returnDate: '',
    startWorkDate: '',
    extensionLetterDate: '',
    delegationPeriod: 0,
    province: '',
    destinationEntity: '',
    purpose: '',
    notes: '',
    disengagementLetterNumber: '',
    extensionPeriod: '',
    extensionLetterNumber: '',
    extensionLetterFile: null,
    disengagementLetterFile: null,
    existingDisengagementLetterFile: null,
    disengagementTimeOption: '',
    travelTimeOption: '',
    returnTimeOption: '',
    startWorkTimeOption: ''
  });

  const iraqProvinces = [
    'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'كركوك', 'الأنبار', 'ديالى', 'واسط',
    'ميسان', 'بابل', 'ذي قار', 'صلاح الدين', 'دهوك', 'السليمانية', 'القادسية', 'المثنى',
  ];

  const [stats, setStats] = useState({
    totalCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    thisMonthCount: 0
  });

  const fetchStats = async () => {
    try {
        const response = await api.get('/api/HR/GetDelegationStats');
        setStats(response.data);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
};

const getLetterNumberOptions = useCallback(() => {
  const groupedDelegations = _.groupBy(delegations.filter(d => d.letterNumber), 'letterNumber');
  
  const options = Object.entries(groupedDelegations).map(([letterNumber, group]) => {
    //const firstEmployeeNumber = group[0]?.employeeNumber || "غير متوفر";
    const count = group.length;
    const date = group[0]?.letterDate ? new Date(group[0].letterDate).toLocaleDateString('ar-IQ') : '';
    
    return {
      value: letterNumber,
      label: `رقم ${letterNumber} - تاريخ ${date} - عدد الموفدين: ${count}`,
      data: group[0]
    };
  });

  return [
    { value: '', label: 'إنشاء أمر إداري جديد' },
    ...options.sort((a, b) => b.value.localeCompare(a.value))
  ];
}, [delegations]);
  

  const fetchUserRoles = async () => {
    try {
      const response = await api.get('/api/HR/GetUserRoles');
      setUserRoles(response.data);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const handleMenuClick = (event, delegation) => {
    //console.log('Selected Delegation:', delegation); // عرض الكائن المحدد
    setAnchorEl(event.currentTarget);
    setSelectedDelegation(delegation);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDelegation(null);
  };

  const handleEditAction = () => {
    if (selectedDelegation) {
      handleEdit(selectedDelegation.id);
    }
    handleMenuClose();
  };

  const handleDeleteAction = () => {
    if (selectedDelegation) {
      handleDelete(selectedDelegation.id);
    }
    handleMenuClose();
  };

  const handleViewFileAction = async (filePath) => {
    if (filePath) {
      try {
        const fileName = filePath.split('/').pop();
        if (!fileName) {
          throw new Error('مسار الملف غير صالح');
        }
  
        const fileUrl = `${api.defaults.baseURL}/DelegationFile/${fileName}`;
        
        setLoading(true);
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
          throw new Error(`خطأ ${response.status}: ${response.statusText}`);
        }
  
        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error('الملف فارغ أو غير موجود');
        }
  
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
  
      } catch (error) {
        console.error('Error accessing file:', error);
        
        let errorMessage = 'تعذر تحميل الملف';
        if (error.message.includes('404')) {
          errorMessage = 'الملف غير موجود';
        } else if (error.message.includes('403')) {
          errorMessage = 'ليس لديك صلاحية الوصول إلى هذا الملف';
        }
  
        Swal.fire({
          icon: 'error',
          title: 'خطأ في الوصول للملف',
          text: `${errorMessage}. ${error.message}`,
          confirmButtonText: 'حسناً',
          showCancelButton: true,
          cancelButtonText: 'إعادة المحاولة',
        }).then((result) => {
          if (result.isDismissed) {
            handleViewFileAction(filePath);
          }
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/HR/GetEmployees');
      if (response.data) {
        setEmployees(response.data);
      }
    } catch (error) {
      setError('فشل في تحميل قائمة الموظفين');
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (selectedOption) => {
    const selectedEmployee = employees.find((emp) => emp.empno === selectedOption.value);
    setFormData((prev) => ({
      ...prev,
      employeeNumber: selectedEmployee?.empno || '',
      employeeName: selectedEmployee?.name || '',
      jobTitle: selectedEmployee?.currentJobTitle || '',
      department: selectedEmployee?.authority || '',
    }));
  };

  const fetchDelegations = useCallback(async () => {
    try {
      setLoading(true);

      // استدعاء نقطة النهاية لجلب الإيفادات
      const response = await api.get('/api/HR/GetDelegationr');

      if (response.status === 200 && response.data) {
        const fetchedDelegations = response.data;

        if (Array.isArray(fetchedDelegations) && fetchedDelegations.length > 0) {
          if (isAdminOrHRAdmin) {
            // console.log(`تم جلب ${fetchedDelegations.length} إيفاد بنجاح`);
            setDelegations(fetchedDelegations);
          } else {
            const pendingDelegations = fetchedDelegations.filter(delegation => !delegation.isApproved);
            // console.log(`تم جلب ${pendingDelegations.length} إيفاد غير مصادق عليه بنجاح`);
            setDelegations(pendingDelegations);
          }
        } else {
          console.warn("لا توجد بيانات لعرضها");
          setDelegations([]);
        }
      } else {
        console.error("فشل في جلب البيانات، تأكد من نقطة النهاية");
        setDelegations([]);
      }
    } catch (error) {
      console.error("حدث خطأ أثناء جلب الإيفادات:", error.message || error);
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, [isAdminOrHRAdmin]); 

  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true);
        await fetchUserRoles();
        await fetchEmployees();
        await fetchStats();
      } catch (error) {
        console.error('Error initializing page:', error);
        setError('حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
  
    initializePage();
  }, []);
  
  const getUniqueSecondaryIdDelegations = useCallback(() => {
    // فلترة القيود التي لها معرف ثانوي
    const filteredDelegations = delegations.filter(d => d.secondaryId !== null);
    
    // تجميع القيود حسب المعرف الثانوي
    const groupedDelegations = _.groupBy(filteredDelegations, 'secondaryId');
    
    // أخذ أول قيد من كل مجموعة
    const uniqueDelegations = Object.values(groupedDelegations).map(group => group[0]);
    
    return uniqueDelegations;
  }, [delegations]);
  
  const getSecondaryIdOptions = useCallback(() => {
    const groupedDelegations = _.groupBy(delegations.filter(d => d.secondaryId), 'secondaryId');
    
    const options = Object.entries(groupedDelegations).map(([secondaryId, group]) => {
      const firstEmployeeNumber = group[0]?.employeeNumber || "غير متوفر"; // الحصول على أول رقم وظيفي
      const count = group.length; // عدد الموفدين
      return {
        value: parseInt(secondaryId),
        label: `(${secondaryId}) اول موفد: ${firstEmployeeNumber}, العدد: ${count}`,
      };
    });
  
    return [
      { value: null, label: 'إنشاء ايفاد جديد' }, 
      ...options.sort((a, b) => b.value - a.value)
    ];
  }, [delegations]);
  
  
  const getDayName = (dateString) => {
    if (!dateString) return '';
    
    // تحويل التاريخ إلى كائن Date
    const date = new Date(dateString);
    
    // التحقق من صحة التاريخ
    if (date instanceof Date && !isNaN(date)) {
      return format(date, 'EEEE', { locale: ar });
    }
    return '';
  };
  
  
  const refreshData = async () => {
    await fetchDelegations();
    await fetchStats();
  };

  
  useEffect(() => {
    fetchStats();
  }, []);

  // استرجاع آخر معرف ثانوي عند التحميل
useEffect(() => {
  const fetchLastSecondaryId = async () => {
    try {
      const response = await api.get('/api/HR/GetLastSecondaryId');
      setLastSecondaryId(response.data.lastSecondaryId || 0);
    } catch (error) {
      console.error('Error fetching last secondary ID:', error);
    }
  };
  fetchLastSecondaryId();
}, []);

// تحديث خيارات المعرف الثانوي
useEffect(() => {
  const updateSecondaryIdOptions = () => {
    const uniqueDelegations = getUniqueSecondaryIdDelegations();
    const options = uniqueDelegations
      .map(delegation => ({
        value: delegation.secondaryId,
        label: `(${delegation.secondaryId}) ${delegation.purpose}`,
      }));
    setSecondaryIdOptions([{ value: null, label: 'إنشاء معرف جديد' }, ...options]);
  };
  updateSecondaryIdOptions();
}, [delegations,getUniqueSecondaryIdDelegations]);

useEffect(() => {
  setSecondaryIdOptions(getSecondaryIdOptions());
}, [delegations, getSecondaryIdOptions]);

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // التحقق من نوع الملف
      if (file.type !== 'application/pdf') {
        Swal.fire({
          icon: 'error',
          title: 'نوع ملف غير صالح',
          text: 'يرجى اختيار ملف PDF فقط',
          confirmButtonText: 'حسناً'
        });
        e.target.value = '';
        return;
      }
      
      // التحقق من حجم الملف (5MB كحد أقصى)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'حجم الملف كبير جداً',
          text: 'يجب أن لا يتجاوز حجم الملف 5 ميجابايت',
          confirmButtonText: 'حسناً'
        });
        e.target.value = '';
        return;
      }
  
      setFormData(prev => ({
        ...prev,
        [fieldName]: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.delegationType || !formData.employeeNumber) {
        setError('يرجى تعبئة جميع الحقول المطلوبة.');
        setLoading(false);
        return;
    }

    const convertToISOString = (date) => {
        if (!date) return undefined;
        const parsedDate = new Date(date);
        return isNaN(parsedDate) ? undefined : parsedDate.toISOString();
    };

    const getDayName = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (date instanceof Date && !isNaN(date)) {
            return format(date, 'EEEE', { locale: ar });
        }
        return '';
    };
    
    const formDataToSend = new FormData();

    // البيانات الأساسية

    formDataToSend.append('inputUser', formData.inputUser || 'اسم المستخدم');

    formDataToSend.append('disengagementTimeOption', formData.disengagementTimeOption);
    formDataToSend.append('travelTimeOption', formData.travelTimeOption);
    formDataToSend.append('returnTimeOption', formData.returnTimeOption);
    formDataToSend.append('startWorkTimeOption', formData.startWorkTimeOption);
    formDataToSend.append('delegationType', formData.delegationType);
    formDataToSend.append('employeeNumber', formData.employeeNumber);
    formDataToSend.append('employeeName', formData.employeeName);
    formDataToSend.append('jobTitle', formData.jobTitle);
    formDataToSend.append('department', formData.department);
    formDataToSend.append('letterNumber', formData.letterNumber);
    formDataToSend.append('delegationPeriod', formData.delegationPeriod);
    formDataToSend.append('province', formData.province);
    formDataToSend.append('destinationEntity', formData.destinationEntity);
    formDataToSend.append('purpose', formData.purpose);
    formDataToSend.append('notes', formData.notes);
    formDataToSend.append('disengagementLetterNumber', formData.disengagementLetterNumber);
    formDataToSend.append('extensionPeriod', formData.extensionPeriod || 0);
    formDataToSend.append('extensionLetterNumber', formData.extensionLetterNumber);
    formDataToSend.append('existingLetterFile', formData.existingLetterFile);
    formDataToSend.append('existingDisengagementLetterFile', formData.existingDisengagementLetterFile);
    formDataToSend.append('existingExtensionLetterFile', formData.existingExtensionLetterFile);

    if (formData.secondaryId) {
      formDataToSend.append('secondaryId', formData.secondaryId);
    }

    // letterDate بدون يوم الأسبوع
    if (formData.letterDate) {
        formDataToSend.append('letterDate', convertToISOString(formData.letterDate));
    }

    // باقي التواريخ مع أيام الأسبوع
    if (formData.disengagementDate) {
        const disengagementDateISO = convertToISOString(formData.disengagementDate);
        formDataToSend.append('disengagementDate', disengagementDateISO);
        formDataToSend.append('disengagementDay', getDayName(formData.disengagementDate));
    }

    if (formData.disengagementLetterDate) {
        const disengagementLetterDateISO = convertToISOString(formData.disengagementLetterDate);
        formDataToSend.append('disengagementLetterDate', disengagementLetterDateISO);
        formDataToSend.append('disengagementLetterDay', getDayName(formData.disengagementLetterDate));
    }

    if (formData.travelDate) {
        const travelDateISO = convertToISOString(formData.travelDate);
        formDataToSend.append('travelDate', travelDateISO);
        formDataToSend.append('travelDay', getDayName(formData.travelDate));
    }

    if (formData.returnDate) {
        const returnDateISO = convertToISOString(formData.returnDate);
        formDataToSend.append('returnDate', returnDateISO);
        formDataToSend.append('returnDay', getDayName(formData.returnDate));
    }

    if (formData.startWorkDate) {
        const startWorkDateISO = convertToISOString(formData.startWorkDate);
        formDataToSend.append('startWorkDate', startWorkDateISO);
        formDataToSend.append('startWorkDay', getDayName(formData.startWorkDate));
    }

    if (formData.extensionLetterDate) {
        const extensionLetterDateISO = convertToISOString(formData.extensionLetterDate);
        formDataToSend.append('extensionLetterDate', extensionLetterDateISO);
        formDataToSend.append('extensionLetterDay', getDayName(formData.extensionLetterDate));
    }

    // إضافة الملفات
    if (formData.letterFile) {
        formDataToSend.append('letterFile', formData.letterFile);
    }

    if (formData.extensionLetterFile) {
        formDataToSend.append('extensionLetterFile', formData.extensionLetterFile);
    }

    if (formData.disengagementLetterFile) {
        formDataToSend.append('disengagementLetterFile', formData.disengagementLetterFile);
    }

    try {
        const response = editingId
            ? await api.put(`/api/HR/UpdateDelegation/${editingId}`, formDataToSend)
            : await api.post('/api/HR/CreateDelegation', formDataToSend);

        if (response.status === 200 || response.status === 201) {
            await refreshData();
            Swal.fire({
                icon: 'success',
                title: editingId ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح',
                showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (error) {
        console.error('Full error response:', error.response?.data || error.message);
        setError(error.response?.data?.message || 'حدث خطأ غير متوقع.');
    } finally {
        setLoading(false);
    }
};

const handleUpdateFullDelegation = async () => {
  if (!formData.secondaryId) {
    Swal.fire({
      icon: 'warning',
      title: 'تنبيه',
      text: 'يرجى اختيار معرف ثانوي أولاً.',
    });
    return;
  }

  try {
    setLoading(true);

    // تجهيز بيانات التحديث من الحقول الموجودة في formData
    const updatedFields = {
      letterNumber: formData.letterNumber || null,
      letterDate: formData.letterDate || null,
      province: formData.province || null,
      destinationEntity: formData.destinationEntity || null,
      purpose: formData.purpose || null,
      disengagementDate: formData.disengagementDate || null,
      disengagementDay: formData.disengagementDate ? getDayName(formData.disengagementDate) : null,
      disengagementTimeOption: formData.disengagementTimeOption || null,
      delegationPeriod: formData.delegationPeriod || null,
      notes: formData.notes || null,
      disengagementLetterNumber: formData.disengagementLetterNumber || null,
      disengagementLetterDate: formData.disengagementLetterDate || null,
      disengagementLetterDay: formData.disengagementLetterDate ? getDayName(formData.disengagementLetterDate) : null,
      travelDate: formData.travelDate || null,
      travelDay: formData.travelDate ? getDayName(formData.travelDate) : null,
      travelTimeOption: formData.travelTimeOption || null,
      returnDate: formData.returnDate || null,
      returnDay: formData.returnDate ? getDayName(formData.returnDate) : null,
      returnTimeOption: formData.returnTimeOption || null,
      startWorkDate: formData.startWorkDate || null,
      startWorkDay: formData.startWorkDate ? getDayName(formData.startWorkDate) : null,
      startWorkTimeOption: formData.startWorkTimeOption || null,
      extensionPeriod: formData.extensionPeriod || null,
      extensionLetterNumber: formData.extensionLetterNumber || null,
      extensionLetterFile: formData.extensionLetterFile || null,
      extensionLetterDate: formData.extensionLetterDate || null,
      delegationType: formData.delegationType || null,
      isApproved: formData.isApproved || null,
      approvalDate: formData.approvalDate || null,
      isApprovedFico: formData.isApprovedFico || null,
      approvalDateFico: formData.approvalDateFico || null,
      disengagementLetterFile: formData.disengagementLetterFile || null,
      notifcation: formData.notifcation || null,
    };

    // إرسال البيانات إلى API
    const response = await api.put(`/api/HR/UpdateFullDelegation/${formData.secondaryId}`, updatedFields);

    if (response.status === 200) {
      await fetchDelegations(); // تحديث القائمة
      Swal.fire({
        icon: 'success',
        title: 'تم التحديث',
        text: 'تم تحديث جميع الإيفادات المرتبطة بنجاح.',
        showConfirmButton: false,
        timer: 1500,
      });
    }
  } catch (error) {
    console.error('Error updating full delegation:', error);
    Swal.fire({
      icon: 'error',
      title: 'خطأ',
      text: 'حدث خطأ أثناء تحديث الإيفادات المرتبطة.',
    });
  } finally {
    setLoading(false);
  }
};

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الايفاد؟')) {
      try {
        const response = await api.delete(`/api/HR/DeleteDelegation/${id}`);
        if (response.status === 200) {
          fetchDelegations();
          fetchStats();
        } else {
          setError('فشل حذف الايفاد.');
        }
      } catch (error) {
        setError('حدث خطأ أثناء حذف الايفاد.');
        console.error('Error deleting delegation:', error);
      }
    }
  };

  const handleApproveAction = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/api/HR/ApproveDelegation/${selectedDelegation.id}`);
  
      if (response.status === 200) {
        // تحديث القائمة باستخدام البيانات المُرجعة من السيرفر
        setDelegations(prevDelegations =>
          prevDelegations.map(del =>
            del.id === selectedDelegation.id
              ? { 
                  ...del, 
                  isApproved: true,
                  approvalDate: response.data.approvalDate // استخدام التاريخ المُرجع من السيرفر
                }
              : del
          )
        );
        fetchStats();
  
        handleMenuClose();
        
        Swal.fire({
          icon: 'success',
          title: 'تمت المصادقة',
          text: 'تمت مصادقة الإيفاد بنجاح'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء المصادقة'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUnapproveAction = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/api/HR/UnapproveDelegation/${selectedDelegation.id}`);
  
      if (response.status === 200) {
        // تحديث القائمة
        setDelegations(prevDelegations =>
          prevDelegations.map(del =>
            del.id === selectedDelegation.id
              ? { ...del, isApproved: false }
              : del
          )
        );
        fetchStats();
  
        handleMenuClose();
        
        Swal.fire({
          icon: 'success',
          title: 'تم إلغاء المصادقة',
          text: 'تم إلغاء المصادقة بنجاح'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء إلغاء المصادقة'
      });
    } finally {
      setLoading(false);
    }
  };

  // Define isValidDate at the top
const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

// Use isValidDate below this definition


const handleEdit = async (id) => {
  try {
    setLoading(true);
    setError('');
    
    const response = await api.get(`/api/HR/GetDelegation/${id}`);
    
    if (!response.data) {
      throw new Error('لم يتم العثور على بيانات الإيفاد');
    }

    const data = response.data;
    //console.log('Delegation data:', data);

    if (data.isApproved) {
      Swal.fire({
        icon: 'warning',
        title: 'غير مسموح بالتعديل',
        text: 'هذا الإيفاد تمت مصادقته ولا يمكن تعديله.',
      });
      return;
    }

    // التحقق من البيانات المطلوبة
    if (!data.id || !data.employeeNumber) {
      throw new Error('البيانات المستلمة غير مكتملة');
    }

    // معالجة التواريخ بشكل آمن
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isValidDate(date)) {
        return format(date, 'yyyy-MM-dd');
      }
      return '';
    };

    setFormData({
      ...data,
      // معالجة التواريخ بشكل آمن وتحويلها إلى التنسيق المطلوب لحقول التاريخ (yyyy-MM-dd)
      letterDate: formatDateForInput(data.letterDate),
      disengagementDate: formatDateForInput(data.disengagementDate),
      disengagementLetterDate: formatDateForInput(data.disengagementLetterDate),
      travelDate: formatDateForInput(data.travelDate),
      returnDate: formatDateForInput(data.returnDate),
      startWorkDate: formatDateForInput(data.startWorkDate),
      extensionLetterDate: formatDateForInput(data.extensionLetterDate),

       // الحقول الإضافية لخيارات الوقت
       disengagementTimeOption: data.disengagementTimeOption || '', // قبل الظهر / بعد الظهر
       travelTimeOption: data.travelTimeOption || '', // قبل الظهر / بعد الظهر
       startWorkTimeOption: data.startWorkTimeOption || '', // قبل الظهر / بعد الظهر
       returnTimeOption: data.returnTimeOption || '', // قبل الساعة السادسة مساءً / بعد الساعة السادسة مساءً
      // نحتفظ بأسماء الملفات الموجودة
      
      letterFile: null,
      disengagementLetterFile: null,
      extensionLetterFile: null,
      existingLetterFile: data.letterFile || null,
      existingDisengagementLetterFile: data.disengagementLetterFile || null,
      existingExtensionLetterFile: data.extensionLetterFile || null,
    });

    setEditingId(id);
    setShowExtension(!!data.extensionPeriod);

    // رسالة نجاح
    Swal.fire({
      icon: 'success',
      title: 'تم تحميل البيانات',
      text: 'يمكنك الآن تعديل بيانات الإيفاد',
      timer: 1500,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('Error details:', error);
    const errorMessage = error.response?.data?.message || error.message || 'فشل جلب تفاصيل الايفاد';
    
    setError(errorMessage);
    Swal.fire({
      icon: 'error',
      title: 'خطأ في تحميل البيانات',
      text: errorMessage,
      confirmButtonText: 'حسناً'
    });
  } finally {
    setLoading(false);
  }
};

const handleReportClick = async () => {
  try {
    // حفظ معرف الإيفاد الحالي والمستخدم في قاعدة البيانات
    if (formData.secondaryId) {
      await api.post('/api/HR/SaveReportInfo', {
        delegationId: formData.secondaryId,
        timestamp: new Date().toISOString()
      });
      
      // الانتقال إلى صفحة التقارير
      window.location.href = '/HR/DocumentEditor';
    } else {
      toast({
        title: "تنبيه",
        description: "الرجاء اختيار معرف إيفاد أولاً",
        variant: "warning",
        duration: 3000
      });
    }
  } catch (error) {
    console.error('Error:', error);
    toast({
      title: "خطأ",
      description: "حدث خطأ أثناء حفظ معلومات التقرير",
      variant: "destructive",
      duration: 3000
    });
  }
};

const handleApproveAllDelegations = async () => {
  if (!formData.secondaryId) {
    Swal.fire({
      icon: 'warning',
      title: 'تنبيه',
      text: 'يرجى اختيار معرف ثانوي أولاً.',
    });
    return;
  }

  try {
    setLoading(true);
    const response = await api.put(`/api/HR/ApproveDelegations`, { SecondaryId: formData.secondaryId });

    if (response.status === 200) {
      await fetchDelegations(); // تحديث قائمة الإيفادات
      Swal.fire({
        icon: 'success',
        title: 'تمت المصادقة',
        text: 'تمت مصادقة جميع الإيفادات بنجاح.',
        showConfirmButton: false,
        timer: 1500,
      });
    }
  } catch (error) {
    console.error('Error approving delegations:', error);
    Swal.fire({
      icon: 'error',
      title: 'خطأ',
      text: 'حدث خطأ أثناء مصادقة الإيفادات.',
    });
  } finally {
    setLoading(false);
  }
};

const letterNumberField = (
<div>
  <Label className="text-gray-700">رقم الكتاب (الأمر الإداري)</Label>
  <div className="flex gap-2">
    <Input
      value={formData.letterNumber}
      onChange={(e) => setFormData({ ...formData, letterNumber: e.target.value })}
      placeholder="أدخل رقم الأمر الإداري"
      className="flex-1"
    />
    <Select
      options={getLetterNumberOptions()}
      value={null}
      onChange={async (selectedOption) => {
        if (selectedOption?.value) {
          try {
            const response = await api.get(`/api/HR/GetFirstEmployeeByLetterNumber/${selectedOption.value}`);
            if (response.status === 200) {
              const data = response.data;
              
              // تنسيق التواريخ بطريقة مختلفة
              const formatDate = (dateString) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${year}-${month}-${day}`;
              };

              setFormData(prev => ({
                ...prev,
                ...data,
                letterNumber: selectedOption.value,
                letterDate: formatDate(data.letterDate),
                disengagementDate: formatDate(data.disengagementDate),
                disengagementLetterDate: formatDate(data.disengagementLetterDate),
                travelDate: formatDate(data.travelDate),
                returnDate: formatDate(data.returnDate),
                startWorkDate: formatDate(data.startWorkDate),
                extensionLetterDate: formatDate(data.extensionLetterDate),
                secondaryId: data.secondaryId
              }));
            }
          } catch (error) {
            console.error("Error fetching delegation data:", error);
            toast({
              title: "خطأ",
              description: "حدث خطأ أثناء جلب بيانات الأمر الإداري",
              variant: "destructive",
              duration: 3000
            });
          }
        }
      }}
      isSearchable
      placeholder="اختر من الأوامر السابقة"
      className="w-64"
      classNamePrefix="select"
      isClearable={true}
    />
  </div>
</div>
);

  return (
  <div className="container mx-auto p-4 rtl">
    <Card className="mb-8 bg-gradient-to-l from-blue-50 to-white">
      <CardHeader className="border-b border-gray-100 pb-6">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
              نظام إدارة الايفادات
            </CardTitle>
            <p className="text-gray-600 text-sm">
              إدارة ومتابعة الإيفادات بشكل فعال
            </p>
          </div>
          
          {/* تم استبدال القسم القديم بالقسم الجديد هنا */}
          <div className="flex gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-1">إجمالي الموفدين</p>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <span className="text-xl font-bold text-gray-800">{stats.totalCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-1">المصادق عليها</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-xl font-bold text-gray-800">{stats.approvedCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-1">قيد الانتظار</p>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-xl font-bold text-gray-800">{stats.pendingCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-1">هذا الشهر</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span className="text-xl font-bold text-gray-800">{stats.thisMonthCount}</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-1">هذا العام</p>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <span className="text-xl font-bold text-gray-800">{stats.thisYearCount}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
<div className="flex justify-between items-center mb-4">
  {/* زر تفريغ الصفحة */}
  <div>
  <Button
    onClick={() => window.location.reload()}
    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
  >
    <RefreshCw className="w-4 h-4" />
    <span>تفريغ الصفحة</span>
  </Button>

  {/* زر إدارة الإيفادات */}
  <Button
    onClick={() => window.location.href = '/HR/list-delegation'}
    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
  >
    <FileText className="w-4 h-4" />
    <span>إدارة الإيفادات</span>
  </Button>
  </div>
  {/* زر طباعة التقارير */}
  <Button
    onClick={handleReportClick}
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
    disabled={!formData.secondaryId}
  >
    <FileText className="w-4 h-4" />
    <span>طباعة التقارير</span>
  </Button>
</div>
{error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
  <form onSubmit={handleSubmit} className="space-y-8">
    
    {/* القسم الأول: المعلومات الأساسية */}
    <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg shadow-lg border-t-4 border-gray-500">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b">أمر الايفاد</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div>
  <Label className="text-gray-700">المعرف الثانوي</Label>
  <Select
    options={secondaryIdOptions}
    value={
      formData.secondaryId
        ? secondaryIdOptions.find(option => option.value === formData.secondaryId) || 
          { value: formData.secondaryId, label: `(${formData.secondaryId}) عدد الموفدين: ${delegations.filter(d => d.secondaryId === formData.secondaryId).length}` }
        : { value: null, label: 'إنشاء معرف جديد' }
    }
    onChange={async (selectedOption) => {
      if (selectedOption.value === null) {
        // إنشاء معرف جديد
        setFormData((prev) => ({
          ...prev,
          secondaryId: lastSecondaryId + 1,
        }));
      } else {
        // استدعاء بيانات أول موظف عبر API بناءً على المعرف الثانوي
        try {
          const response = await api.get(`/api/HR/GetFirstEmployeeBySecondaryId/${selectedOption.value}`);
          if (response.status === 200) {
            const data = response.data;

            // دالة تنسيق التواريخ
            const formatDate = (dateString) => {
              if (!dateString) return '';
              const date = new Date(dateString);
              const day = date.getDate().toString().padStart(2, '0');
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const year = date.getFullYear();
              return `${year}-${month}-${day}`;
            };

            setFormData((prev) => ({
              ...prev,
              ...data,
              letterDate: formatDate(data.letterDate),
              disengagementDate: formatDate(data.disengagementDate),
              disengagementLetterDate: formatDate(data.disengagementLetterDate),
              travelDate: formatDate(data.travelDate),
              returnDate: formatDate(data.returnDate),
              startWorkDate: formatDate(data.startWorkDate),
              extensionLetterDate: formatDate(data.extensionLetterDate),
              secondaryId: selectedOption.value
            }));
          }
        } catch (error) {
          console.error("Error fetching first employee:", error);
        }
      }
    }}
    isSearchable
    placeholder="اختر المعرف الثانوي"
    className="basic-single"
    classNamePrefix="select"
  />
</div>
{/* رقم الكتاب */}
{/* رقم الكتاب */}
<div>
{letterNumberField}
</div>
                        {/* تاريخ الكتاب */}
                        <div>
  <Label className="text-gray-700">تاريخ الكتاب (الأمر الإداري)</Label>
  <DatePicker
    selected={formData.letterDate ? new Date(formData.letterDate) : null}
    onChange={(date) => setFormData({ ...formData, letterDate: format(date, 'yyyy-MM-dd') })}
    dateFormat="dd/MM/yyyy"
    locale={ar}
    className="w-full px-3 py-2 border rounded-md"
  />
</div>
        <div>
          <Label className="text-gray-700">الرقم الوظيفي</Label>
          <Select
            options={employees.map((emp) => ({
              label: `${emp.empno} - ${emp.name}`,
              value: emp.empno,
            }))}
            onChange={handleEmployeeSelect}
            value={employees.find((emp) => emp.empno === formData.employeeNumber)
              ? {
                  label: `${formData.employeeNumber} - ${formData.employeeName}`,
                  value: formData.employeeNumber,
                }
              : null
            }
            isSearchable
            placeholder="اختر الموظف"
            className="basic-single"
            classNamePrefix="select"
          />
        </div>

        {/* الاسم */}
        <div>
          <Label className="text-gray-700">الاسم</Label>
          <Input value={formData.employeeName} readOnly className="bg-gray-50" />
        </div>

        {/* العنوان الوظيفي */}
        <div>
          <Label className="text-gray-700">العنوان الوظيفي</Label>
          <Input value={formData.jobTitle} readOnly className="bg-gray-50" />
        </div>

        {/* الهيئة/القسم */}
        <div>
          <Label className="text-gray-700">الهيئة/القسم</Label>
          <Input value={formData.department} readOnly className="bg-gray-50" />
        </div>

      {/* نوع الايفاد */}
      <div>
        <Label>نوع الايفاد</Label>
        <select
          value={formData.delegationType}
          onChange={(e) => setFormData({ ...formData, delegationType: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
          required
        >
          <option value="">اختر نوع الايفاد</option>
          <option value="داخلي">داخلي</option>
          <option value="خارجي">خارجي</option>
        </select>
      </div>
      
      <div>
    <Label className="text-gray-700">المحافظة</Label>
    <select
      value={formData.province}
      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
      required
    >
      <option value="">اختر المحافظة</option>
      {iraqProvinces.map((province) => (
        <option key={province} value={province}>{province}</option>
      ))}
    </select>
  </div>

  {/* الجهة المرسل اليها */}
  <div>
    <Label className="text-gray-700">الجهة المرسل إليها</Label>
    <Input
      value={formData.destinationEntity}
      onChange={(e) => setFormData({ ...formData, destinationEntity: e.target.value })}
      required
    />
  </div>

  {/* الغرض من الإيفاد - يأخذ مكان عمودين */}
  <div className="col-span-2">
    <Label className="text-gray-700">الغرض من الإيفاد</Label>
    <Textarea
      value={formData.purpose}
      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
      rows={3} // عدد الأسطر الافتراضي
      className="w-full px-3 py-2 border rounded-md resize-none"
      required
    />
  </div>

  {/* مدة الإيفاد */}
  <div>
    <Label className="text-gray-700">مدة الإيفاد</Label>
    <Input
      type="number"
      value={formData.delegationPeriod}
      onChange={(e) => setFormData({ ...formData, delegationPeriod: parseInt(e.target.value) || 0 })}
      required
    />
  </div>

  {/* تاريخ الانفكاك - في سطر منفصل */}
  <div className="col-span-1">
    <Label className="text-gray-700">تاريخ الانفكاك</Label>
    <DatePicker
      selected={formData.disengagementDate ? new Date(formData.disengagementDate) : null}
      onChange={(date) => setFormData({ ...formData, disengagementDate: format(date, 'yyyy-MM-dd') })}
      dateFormat="dd/MM/yyyy"
      locale={ar}
      className="w-full px-3 py-2 border rounded-md"
    />
  </div>
      </div>
      {/* القسم الرابع: التمديد */}
      <div>
        <div className='p-4'>
      <div className="flex items-center justify-between mb-6 pb-2 border-b">
        <h2 className="text-xl font-semibold text-gray-800">تمديد الايفاد (في حال وجود تمديد)</h2>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showExtension}
            onChange={(e) => setShowExtension(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-gray-600">إضافة تمديد</span>
        </div>
      </div>
      </div>

      {showExtension && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
            <Label className="text-gray-700">مدة التمديد</Label>
            <Input
              type="number"
              value={formData.extensionPeriod || ''}
              onChange={(e) => setFormData({ ...formData, extensionPeriod: e.target.value })}
              required={showExtension}
            />
          </div>
            <div>
            <Label className="text-gray-700">رقم أمر التمديد</Label>
            <Input
              value={formData.extensionLetterNumber}
              onChange={(e) => setFormData({ ...formData, extensionLetterNumber: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-gray-700">تاريخ كتاب التمديد</Label>
            <Input
              type="date"
              value={formData.extensionLetterDate || ''}
              onChange={(e) => setFormData({ ...formData, extensionLetterDate: e.target.value })}
            />
            {formData.extensionLetterDate && (
              <span className="text-sm text-blue-600 mt-1 block">{getDayName(formData.extensionLetterDate)}</span>
            )}
          </div>
        </div>
      )}
    </div>
    </div>

    {/* القسم الثالث: كتاب الانفكاك */}
    <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg shadow-lg border-t-4 border-purple-500">
  <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b text-center">أمر الانفكاك</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* رقم كتاب الانفكاك */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">رقم كتاب الانفكاك</Label>
      <Input
        value={formData.disengagementLetterNumber}
        onChange={(e) => setFormData({ ...formData, disengagementLetterNumber: e.target.value })}
      />
    </div>

    {/* تاريخ كتاب الانفكاك */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">تاريخ كتاب الانفكاك</Label>
      <div className="flex items-center gap-2">
      <DatePicker
                selected={formData.disengagementLetterDate ? new Date(formData.disengagementLetterDate) : null}
                onChange={(date) => setFormData({ ...formData, disengagementLetterDate: format(date, 'yyyy-MM-dd') })}
                dateFormat="dd/MM/yyyy"
                locale={ar}
                className="w-full px-3 py-2 border rounded-md"
              />
        {formData.disengagementLetterDate && (
          <span className="text-sm text-blue-600">{getDayName(formData.disengagementLetterDate)}</span>
        )}
      </div>
    </div>

    {/* تاريخ الانفكاك */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">تاريخ الانفكاك</Label>
      <div className="flex items-center gap-2">
      <DatePicker
                selected={formData.disengagementDate ? new Date(formData.disengagementDate) : null}
                onChange={(date) => setFormData({ ...formData, disengagementDate: format(date, 'yyyy-MM-dd') })}
                dateFormat="dd/MM/yyyy"
                locale={ar}
                className="w-full px-3 py-2 border rounded-md"
              />
        <span className="text-sm text-blue-600">{getDayName(formData.disengagementDate)}</span>
        <select
          value={formData.disengagementTimeOption || ''}
          onChange={(e) => setFormData({ ...formData, disengagementTimeOption: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm w-32"
        >
          <option value="">اختر الخيار</option>
          <option value="قبل الظهر">قبل الظهر</option>
          <option value="بعد الظهر">بعد الظهر</option>
        </select>
      </div>
    </div>

    {/* تاريخ السفر */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">تاريخ السفر</Label>
      <div className="flex items-center gap-2">
      <DatePicker
                selected={formData.travelDate ? new Date(formData.travelDate) : null}
                onChange={(date) => setFormData({ ...formData, travelDate: format(date, 'yyyy-MM-dd') })}
                dateFormat="dd/MM/yyyy"
                locale={ar}
                className="w-full px-3 py-2 border rounded-md"
              />
        <span className="text-sm text-blue-600">{getDayName(formData.travelDate)}</span>
        <select
          value={formData.travelTimeOption || ''}
          onChange={(e) => setFormData({ ...formData, travelTimeOption: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm w-32"
        >
          <option value="">اختر الخيار</option>
          <option value="قبل الظهر">قبل الظهر</option>
          <option value="بعد الظهر">بعد الظهر</option>
        </select>
      </div>
    </div>

    {/* تاريخ العودة */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">تاريخ العودة</Label>
      <div className="flex items-center gap-2">
      <DatePicker
                selected={formData.returnDate ? new Date(formData.returnDate) : null}
                onChange={(date) => setFormData({ ...formData, returnDate: format(date, 'yyyy-MM-dd') })}
                dateFormat="dd/MM/yyyy"
                locale={ar}
                className="w-full px-3 py-2 border rounded-md"
              />
        <span className="text-sm text-blue-600">{getDayName(formData.returnDate)}</span>
        <select
        value={formData.returnTimeOption || ''}
        onChange={(e) => setFormData({ ...formData, returnTimeOption: e.target.value })}
        className="text-sm px-2 py-1 border rounded-md w-32"
      >
        <option value="">اختر الخيار</option>
        <option value="قبل الساعة السادسة مساءً">قبل الساعة السادسة مساءً</option>
        <option value="بعد الساعة السادسة مساءً">بعد الساعة السادسة مساءً</option>
      </select>
      </div>
    </div>

    {/* تاريخ المباشرة */}
    <div className="flex flex-col max-w-xs">
      <Label className="text-gray-700 mb-1">تاريخ المباشرة</Label>
      <div className="flex items-center gap-2">
      <DatePicker
                selected={formData.startWorkDate ? new Date(formData.startWorkDate) : null}
                onChange={(date) => setFormData({ ...formData, startWorkDate: format(date, 'yyyy-MM-dd') })}
                dateFormat="dd/MM/yyyy"
                locale={ar}
                className="w-full px-3 py-2 border rounded-md"
              />
        <span className="text-sm text-blue-600">{getDayName(formData.startWorkDate)}</span>
        <select
          value={formData.startWorkTimeOption || ''}
          onChange={(e) => setFormData({ ...formData, startWorkTimeOption: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm w-32"
        >
          <option value="">اختر الخيار</option>
          <option value="قبل الظهر">قبل الظهر</option>
          <option value="بعد الظهر">بعد الظهر</option>
        </select>
      </div>
    </div>
  </div>
</div>
        {/* القسم الخامس: الملاحظات */}
        <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg shadow-lg border-t-4 border-pink-500">
  <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">الملاحظات والأرشفة</h2>
  <div className="flex flex-col lg:flex-row gap-6">
    {/* الملاحظات */}
    <div className="flex-1">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">الملاحظات</h3>
      <Textarea
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        className="h-32 w-full rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500"
        placeholder="أضف ملاحظاتك هنا..."
      />
    </div>

    {/* الأرشفة */}
<div className="flex-1">
  <h3 className="text-lg font-semibold text-gray-800 mb-4">أرشفة الأوامر</h3>
  <div className="flex items-center gap-4">
    {/* زر رفع الملف */}
    <div className="flex items-center justify-center">
      <input
        type="file"
        id="letterFile"
        accept="application/pdf"
        onChange={(e) => handleFileChange(e, 'letterFile')}
        className="hidden"
      />
      <label
        htmlFor="letterFile"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"
      >
        <FileUp className="w-6 h-6 text-gray-600" />
      </label>
      {formData.letterFile && (
        <span className="ml-2 text-sm text-gray-600 truncate">
          {formData.letterFile.name}
        </span>
      )}
    </div>

    {/* زر عرض الملف */}
    {(formData.letterFile || formData.existingLetterFile) && (
  <Button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      // إذا كان الملف جديداً (تم رفعه للتو)
      if (formData.letterFile instanceof File) {
        const url = URL.createObjectURL(formData.letterFile);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } 
      // إذا كان الملف موجوداً مسبقاً (تم جلبه من قاعدة البيانات)
      else if (formData.existingLetterFile) {
        handleViewFileAction(formData.existingLetterFile);
      }
    }}
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
  >
    <FileText className="w-4 h-4" />
    <span>عرض الكتاب</span>
  </Button>
)}
  </div>
</div>
  </div>
</div>
    {/* زر الحفظ */}
    <div className="flex justify-end mt-8 gap-4">
      <Button 
        type="submit" 
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري الحفظ...</span>
          </>
        ) : (
          <>
            {editingId ? (
              <>
                <Edit className="w-5 h-5" />
                <span>تحديث الإيفاد</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>إضافة إيفاد</span>
              </>
            )}
          </>
        )}
      </Button>
      <div >
      {isAdminOrHRAdmin && (
          <Button 
            onClick={handleUpdateFullDelegation}
            disabled={loading || !formData.secondaryId}
            className="bg-gray-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            <span>تحديث جميع البيانات لكل الموفدين</span>
          </Button>
          
        )}
      </div>
      <div>
      {isAdminOrHRAdmin && (
        <Button
        onClick={handleApproveAllDelegations}
        disabled={loading || !formData.secondaryId}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
      >
        <CheckCircle className="w-5 h-5" />
        <span>مصادقة إيفاد</span>
      </Button>
        )}
      </div>
    </div>
  </form>
          </CardContent>
        </Card>
        <Card>
    <CardHeader>
      <CardTitle className="text-xl font-bold">قائمة الايفادات</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      ) : delegations.length > 0 ? (
<Card>
  <CardHeader>
    <CardTitle className="text-xl font-bold">قائمة الايفادات</CardTitle>
  </CardHeader>
  <CardContent className="p-6">
    {loading ? (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    ) : delegations.length > 0 ? (
      <GroupedDelegationsTable 
        delegations={delegations} 
        format={format} 
        handleMenuClick={handleMenuClick} 
      />
    ) : (
      <div className="text-center text-gray-500 py-8">
        لا توجد بيانات لعرضها.
      </div>
    )}
  </CardContent>
</Card>
      ) : (
        <div className="text-center text-gray-500 mt-4">
          لا توجد بيانات لعرضها.
        </div>
      )}
    </CardContent>
  </Card>

  <Menu
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={handleMenuClose}
    keepMounted
    {...(!Boolean(anchorEl) ? { 'aria-hidden': true, inert: 'true' } : {})}
  >
    {/* زر تعديل */}
    <MenuItem
    onClick={handleEditAction}
    disabled={selectedDelegation?.isApproved}
  >
    <Edit className="w-4 h-4 mr-2" /> تعديل
  </MenuItem>

  {/* زر حذف */}
  <MenuItem
    onClick={handleDeleteAction}
    disabled={selectedDelegation?.isApproved}
  >
    <Trash className="w-4 h-4 mr-2 text-red-600" /> حذف
  </MenuItem>

    {/* عرض ملف الكتاب */}
    {selectedDelegation?.letterFile && (
      <MenuItem onClick={() => handleViewFileAction(selectedDelegation.letterFile)}>
        <FileText className="w-4 h-4 mr-2" /> عرض ملف الكتاب
      </MenuItem>
    )}

    {/* عرض ملف التمديد */}
    {selectedDelegation?.extensionLetterFile && (
      <MenuItem onClick={() => handleViewFileAction(selectedDelegation.extensionLetterFile)}>
        <FileText className="w-4 h-4 mr-2" /> عرض ملف التمديد
      </MenuItem>
    )}

    {/* عرض ملف الانفكاك */}
    {selectedDelegation?.disengagementLetterFile && (
    <MenuItem onClick={() => handleViewFileAction(selectedDelegation.disengagementLetterFile)}>
      <FileText className="w-4 h-4 mr-2" /> عرض ملف الانفكاك
    </MenuItem>
  )}

  {isAdminOrHRAdmin && (
    <MenuItem
      onClick={() => {
        if (selectedDelegation?.isApproved) {
          handleUnapproveAction();
        } else {
          handleApproveAction();
        }
      }}
    >
      {selectedDelegation?.isApproved ? (
        <>
          <Trash className="w-4 h-4 mr-2 text-orange-600" /> 
          إلغاء المصادقة
        </>
      ) : (
        <>
          <Plus className="w-4 h-4 mr-2 text-green-600" /> 
          مصادقة
        </>
      )}
    </MenuItem>
  )}
  </Menu>


      </div>
  );
};

export default DelegationManagement;