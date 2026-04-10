// مكون فرعي للتقسيط
const InstallmentManager = ({ productId, token }) => {
  const [selectedWayIds, setSelectedWayIds] = useState([]);
  const [availableWays, setAvailableWays] = useState([]);

  // جلب البيانات
  useEffect(() => {
    fetchInstallmentData();
  }, []);

  const fetchInstallmentData = async () => {
    // جلب طرق التقسيط المتاحة
    const waysRes = await axios.get(`${baseURL}market/get_installment_ways`);
    setAvailableWays(waysRes.data.data?.installment_ways || []);

    // جلب التقسيط الحالي للمنتج
    const productRes = await axios.post(`${baseURL}market/product/show`, {
      id: productId,
    });
    const currentInstallments = productRes.data.data?.installment_ways || [];
    setSelectedWayIds(currentInstallments.map((item) => item.id));
  };

  // تبديل التقسيط
  const toggleInstallment = async (wayId) => {
    const isSelected = selectedWayIds.includes(wayId);

    if (isSelected) {
      // حذف التقسيط
      await removeInstallment(wayId);
      setSelectedWayIds((prev) => prev.filter((id) => id !== wayId));
    } else {
      // إضافة التقسيط
      await addInstallment(wayId);
      setSelectedWayIds((prev) => [...prev, wayId]);
    }
  };

  return (
    <div>
      {availableWays.map((way) => (
        <div key={way.id}>
          <input
            type="checkbox"
            checked={selectedWayIds.includes(way.id)}
            onChange={() => toggleInstallment(way.id)}
          />
          <span>{way.name_ar}</span>
        </div>
      ))}
    </div>
  );
};
