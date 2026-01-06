import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Table, Modal, message, DatePicker, Popover, Select, Tag, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import http from "../../api/axios";  
import "./rentalOrderManagement.css";
const RentalOrderManagement = () => {
  const [query, setQuery] = useState({
    plate: '',
    driverName: '',
    operatorName: '',
    carType: '',
    rentRecordStatus: '',
    rentDueMonth: '',
  });

  const [tableData, setTableData] = useState([]);
  const [editingRow, setEditingRow] = useState(null); // 编辑行数据
  const [isEditModalVisible, setIsEditModalVisible] = useState(false); // 编辑弹窗
  const [modalMode, setModalMode] = useState("edit"); // edit | add
  const [editForm] = Form.useForm();
  const [remarkEditingId, setRemarkEditingId] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState("");

  // 删除弹窗相关
  const [deleteId, setDeleteId] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteMode, setDeleteMode] = useState("rentRecord"); // rentRecord | order
  const [viewMode, setViewMode] = useState("orders"); // orders | rentRecords

  const uniqueOptions = useMemo(() => {
    const plates = new Set();
    const carTypes = new Set();
    const driverNames = new Set();
    const operatorNames = new Set();
    const rentMonths = new Set();
    tableData.forEach((item) => {
      if (item.plate) plates.add(item.plate);
      if (item.carType) carTypes.add(item.carType);
      if (item.driverName) driverNames.add(item.driverName);
      if (item.operatorName) operatorNames.add(item.operatorName);
      if (item.rentDueDate) {
        rentMonths.add(item.rentDueDate.slice(0, 7));
      }
    });
    return {
      plates: Array.from(plates),
      carTypes: Array.from(carTypes),
      driverNames: Array.from(driverNames),
      operatorNames: Array.from(operatorNames),
      rentMonths: Array.from(rentMonths).sort().reverse(),
    };
  }, [tableData]);

  const filterTitle = (label, key, options) => (
    <Popover
      trigger="click"
      content={
        <div style={{ width: 200 }}>
          <Select
            showSearch
            allowClear
            placeholder={`请选择${label}`}
            value={query[key] || undefined}
            onChange={(val) => {
              const merged = { ...query, [key]: val || "" };
              setQuery(merged);
              getTableData(merged);
            }}
            options={options.map((val) => ({ value: val, label: val }))}
            style={{ width: "100%" }}
          />
        </div>
      }
    >
      <span style={{ cursor: "pointer" }}>{label}</span>
    </Popover>
  );

  const statusTitle = (label, key) => (
    <Popover
      trigger="click"
      content={
        <div style={{ width: 180 }}>
          <Select
            allowClear
            placeholder="请选择状态"
            value={query[key] || undefined}
            onChange={(val) => {
              const merged = { ...query, [key]: val || "" };
              setQuery(merged);
              getTableData(merged);
            }}
            options={[
              { value: "unsettled", label: "未结算" },
              { value: "settled", label: "已结算" },
            ]}
            style={{ width: "100%" }}
          />
        </div>
      }
    >
      <span style={{ cursor: "pointer" }}>{label}</span>
    </Popover>
  );

  const baseColumns = [
    {
      title: filterTitle("车牌号", "plate", uniqueOptions.plates),
      dataIndex: 'plate',
      key: 'plate',
      align: 'center',
      render: (_, row) => {
        const periodText = row.startDate && row.endDate
          ? `${row.startDate} ~ ${row.endDate}`
          : "未设置";
        return (
          <Popover
            trigger="click"
            content={<div style={{ maxWidth: 220 }}>{periodText}</div>}
          >
            <span style={{ cursor: "pointer" }}>{row.plate}</span>
          </Popover>
        );
      },
    },
    {
      title: filterTitle("车型信息", "carType", uniqueOptions.carTypes),
      dataIndex: 'carType',
      key: 'carType',
      align: 'center',
    },
    {
      title: filterTitle("司机姓名", "driverName", uniqueOptions.driverNames),
      dataIndex: 'driverName',
      key: 'driverName',
      align: 'center',
    },
    { title: '司机电话', dataIndex: 'driverPhone', key: 'driverPhone', align: 'center' },
    {
      title: filterTitle("经办人", "operatorName", uniqueOptions.operatorNames),
      dataIndex: 'operatorName',
      key: 'operatorName',
      align: 'center',
    },
  ];

  const rentRecordColumns = [
    ...baseColumns,
    {
      title: filterTitle("收租日期", "rentDueMonth", uniqueOptions.rentMonths),
      dataIndex: 'rentDueDate',
      key: 'rentDueDate',
      align: 'center',
    },
    { title: '租金', dataIndex: 'rent', key: 'rent', align: 'center' },
    {
      title: statusTitle("收租状态", "rentRecordStatus"),
      dataIndex: 'rentRecordStatus',
      key: 'rentRecordStatus',
      align: 'center',
      render: (val) =>
        val === 'settled' ? (
          <Tag color="success">已结算</Tag>
        ) : (
          <Tag color="processing">未结算</Tag>
        ),
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, row) => (
        <div className="rental-order-actions">
          <Button type="link" className="action-btn" onClick={() => handleSettle(row)}>结算</Button>
          <Button type="link" className="action-btn" onClick={() => openEditModal(row)}>编辑</Button>
          <Button type="link" className="action-btn" danger onClick={() => showDeleteModal(row, "rentRecord")}>删除</Button>
        </div>
      )
    }
    ,
    {
      title: '备注',
      dataIndex: 'rentRecordRemark',
      key: 'rentRecordRemark',
      align: 'center',
      render: (_, row) => (
        <Popover
          trigger="click"
          open={remarkEditingId === row.rentRecordId}
          onOpenChange={async (open) => {
            if (open) {
              setRemarkEditingId(row.rentRecordId);
              setRemarkDraft(row.rentRecordRemark || "");
              return;
            }
            if (remarkEditingId !== row.rentRecordId) return;
            const nextRemark = (remarkDraft || "").trim();
            const prevRemark = row.rentRecordRemark || "";
            setRemarkEditingId(null);
            if (nextRemark === prevRemark) return;
            try {
              await http.request({
                url: `/rent-records/${row.rentRecordId}`,
                method: "put",
                data: { remark: nextRemark },
              });
              setTableData((prev) =>
                prev.map((item) =>
                  item.rentRecordId === row.rentRecordId
                    ? { ...item, rentRecordRemark: nextRemark }
                    : item
                )
              );
            } catch (err) {
              console.error("备注保存失败:", err);
              message.error("备注保存失败");
            }
          }}
          content={
            <Input.TextArea
              value={remarkDraft}
              placeholder="填写备注"
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{ width: 260 }}
              onChange={(e) => setRemarkDraft(e.target.value)}
            />
          }
        >
          <div
            style={{
              maxWidth: 90,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
              color: row.rentRecordRemark ? "inherit" : "#999",
            }}
          >
            {row.rentRecordRemark || "点击填写"}
          </div>
        </Popover>
      ),
    },
  ];

  const orderColumns = [
    ...baseColumns,
    {
      title: '租期',
      key: 'rentPeriod',
      align: 'center',
      render: (_, row) =>
        row.startDate && row.endDate
          ? `${row.startDate} ~ ${row.endDate}`
          : "-",
    },
    { title: '押金', dataIndex: 'deposit', key: 'deposit', align: 'center' },
    { title: '租金', dataIndex: 'rent', key: 'rent', align: 'center' },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, row) => (
        <div className="rental-order-actions">
          <Button type="link" className="action-btn" onClick={() => openEditModal(row)}>编辑</Button>
          <Button type="link" className="action-btn" danger onClick={() => showDeleteModal(row, "order")}>删除</Button>
        </div>
      )
    },
  ];

  const handleSettle = (row) => {
    if (row.rentRecordStatus === 'settled') {
      Modal.confirm({
        title: "已结清，是否重置状态？",
        okText: "是",
        cancelText: "否",
        onOk: async () => {
          try {
            await http.request({
              url: `/rent-records/${row.rentRecordId}`,
              method: "put",
              data: { status: "unsettled" },
            });
            message.success("已重置为未结清");
            getTableData(query);
          } catch (e) {
            console.error("重置失败:", e);
            message.error("重置失败");
          }
        },
      });
      return;
    }
    settleOrder(row);
  };

  const settleOrder = async (row) => {
    await http.request({
      url: `/rent-records/${row.rentRecordId}`,
      method: "put",
      data: { status: "settled" },
    });
    message.success("已结清");
    getTableData(query);
  };


  const loadVehicles = async () => {
    try {
      const res = await http.request({
        url: "/vehicles",
        method: "get",
      });
      setVehicleOptions(res.list || []);
    } catch (e) {
      console.error("获取车辆列表失败:", e);
    }
  };

  // 获取列表数据
  const getTableData = async (params = {}, mode = viewMode) => {
    try {
      const res = await http.request({
        url: mode === "orders" ? "/rental-orders" : "/rent-records",
        method: "get",
        params,
      });
      const sorted = (res.list || []).slice().sort((a, b) => {
        const plateCompare = (a.plate || "").localeCompare(b.plate || "");
        if (plateCompare !== 0) return plateCompare;

        const carTypeCompare = (a.carType || "").localeCompare(b.carType || "");
        if (carTypeCompare !== 0) return carTypeCompare;

        if (mode === "rentRecords") {
          const statusA = a.rentRecordStatus !== "settled" ? 0 : 1;
          const statusB = b.rentRecordStatus !== "settled" ? 0 : 1;
          if (statusA !== statusB) return statusA - statusB;

          const dueA = dayjs(a.rentDueDate || 0).valueOf();
          const dueB = dayjs(b.rentDueDate || 0).valueOf();
          return dueB - dueA;
        }

        const endA = dayjs(a.endDate || 0).valueOf();
        const endB = dayjs(b.endDate || 0).valueOf();
        return endB - endA;
      });
      setTableData(sorted);
    } catch (e) {
      console.error("获取列表失败:", e);
    }
  };

  // 查询表单提交
  const handleFinish = async (values)  => {
    const merged = { ...query, ...values };
    setQuery(merged);
    getTableData(merged);
    console.log("提交的查询 JSON:", values);
  };

  const openEditModal = (row) => {
    setModalMode("edit");
    setEditingRow(row);
    setIsEditModalVisible(true);
    setSelectedPlate(row.plate || "");
    // 处理日期为 dayjs 对象
    editForm.setFieldsValue({
      ...row,
      startDate: row.startDate ? dayjs(row.startDate) : null,
      endDate: row.endDate ? dayjs(row.endDate) : null,
    });
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingRow(null);
    setIsEditModalVisible(true);
    setSelectedPlate("");
    editForm.resetFields();
  };

  // 修改 handleEditOk 方法，保存时格式化日期为字符串
  const handleEditOk = () => {
    editForm.validateFields().then(async values => {
      const payload = {
        ...values,
        startDate: values.startDate ? values.startDate.format("YYYY-MM-DD") : "",
        endDate: values.endDate ? values.endDate.format("YYYY-MM-DD") : "",
      };
      try {
        if (modalMode === "add") {
          await http.request({
            url: "/rental-orders",
            method: "post",
            data: payload,
          });
          message.success("新增成功");
        } else {
          const orderId = editingRow.orderId || editingRow.id;
          await http.request({
            url: `/rental-orders/${orderId}`,
            method: "put",
            data: payload,
          });
          message.success("编辑成功");
        }
        setIsEditModalVisible(false);
        getTableData(query);
      } catch (e) {
        console.error("保存失败:", e);
      }
    });
  };

  const handleEditCancel = () => {
    setIsEditModalVisible(false);
  };

  // 删除
  const showDeleteModal = (row, mode) => {
    setDeleteMode(mode);
    setDeleteRow(row);
    setDeleteId(mode === "order" ? (row.orderId || row.id) : row.rentRecordId);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteOk = () => {
    http
      .request({
        url: deleteMode === "order"
          ? `/rental-orders/${deleteId}/with-records`
          : `/rent-records/${deleteId}`,
        method: "delete",
      })
      .then((res) => {
        if (deleteMode === "order") {
          setIsDeleteModalVisible(false);
          setDeleteRow(null);
          message.success("订单已删除");
          getTableData(query);
          return;
        }
        const { remaining, orderId } = res || {};
        if (remaining === 0 && deleteRow) {
          Modal.confirm({
            title: `此记录为“${deleteRow.plate}”车辆的“${deleteRow.startDate} ~ ${deleteRow.endDate}”订单的最后一条收租记录，是否同时删除该笔订单记录？`,
            okText: "确认",
            cancelText: "取消",
            onOk: () => {
              http
                .request({
                  url: `/rental-orders/${orderId}/with-records`,
                  method: "delete",
                })
                .then(() => {
                  message.success("订单已删除");
                  setIsDeleteModalVisible(false);
                  setDeleteRow(null);
                  getTableData(query);
                })
                .catch((e) => {
                  console.error("删除订单失败:", e);
                });
            },
            onCancel: () => {
              setIsDeleteModalVisible(false);
              setDeleteRow(null);
              getTableData(query);
            },
          });
        } else {
          setIsDeleteModalVisible(false);
          setDeleteRow(null);
          message.success("删除成功");
          getTableData(query);
        }
      })
      .catch((e) => {
        console.error("删除失败:", e);
      });
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setDeleteRow(null);
  };

  useEffect(() => {
    getTableData({}, viewMode);
    loadVehicles();
  }, [viewMode]);

  const plateShadeMap = useMemo(() => {
    const map = new Map();
    let flag = 0;
    for (const item of tableData) {
      const plate = item.plate || "";
      if (!map.has(plate)) {
        map.set(plate, flag);
        flag = flag === 0 ? 1 : 0;
      }
    }
    return map;
  }, [tableData]);

  const plateFirstIndex = useMemo(() => {
    const indexMap = new Map();
    tableData.forEach((item, idx) => {
      const plate = item.plate || "";
      if (!indexMap.has(plate)) {
        indexMap.set(plate, idx);
      }
    });
    return indexMap;
  }, [tableData]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Button
            type={viewMode === "orders" ? "primary" : "default"}
            onClick={() => setViewMode("orders")}
          >
            订单折叠
          </Button>
          <Button
            type={viewMode === "rentRecords" ? "primary" : "default"}
            onClick={() => setViewMode("rentRecords")}
          >
            记录展开
          </Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Upload
            showUploadList={false}
            accept=".csv"
            beforeUpload={(file) => {
              const formData = new FormData();
              formData.append("file", file);
              http
                .request({
                  url: "/import/rent",
                  method: "post",
                  data: formData,
                  headers: { "Content-Type": "multipart/form-data" },
                })
                .then((res) => {
                  message.success(
                    `导入完成：订单${res.insertedOrders || 0}，收租记录${res.insertedRecords || 0}，跳过${res.skipped || 0}`
                  );
                  if (res.errors && res.errors.length) {
                    message.warning(`部分失败：${res.errors.slice(0, 3).join("；")}`);
                  }
                  getTableData(query);
                })
                .catch((e) => {
                  message.error(e?.response?.data?.message || "导入失败");
                });
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
          <Button type="primary" onClick={openAddModal}>新增</Button>
        </div>
      </div>
      <Table
        columns={viewMode === "orders" ? orderColumns : rentRecordColumns}
        dataSource={tableData}
        rowKey={viewMode === "orders" ? "id" : "rentRecordId"}
        pagination={false}
        rowClassName={(record, index) => {
          const classes = [];
          if (plateShadeMap.get(record.plate || "") === 1) {
            classes.push("plate-shade-row");
          }
          const firstIndex = plateFirstIndex.get(record.plate || "");
          if (firstIndex === index && index !== 0) {
            classes.push("plate-group-start");
          }
          return classes.join(" ");
        }}
      />



      {/* 编辑弹窗 */}
      <Modal
        title={modalMode === "add" ? "新增车辆信息" : "编辑车辆信息"}
        open={isEditModalVisible}
        onOk={handleEditOk}
        onCancel={handleEditCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={{}}
>
          <Form.Item label="车牌号" name="plate" rules={[{ required: true, message: '请选择车牌号' }]}>
            <Select
              showSearch
              placeholder="请选择车牌号"
              onChange={(value) => {
                setSelectedPlate(value || "");
                const match = vehicleOptions.find((item) => item.plate === value);
                if (match && match.carType) {
                  editForm.setFieldsValue({ carType: match.carType });
                }
              }}
              options={[...new Set(vehicleOptions.map((item) => item.plate))].map((plate) => ({
                value: plate,
                label: plate,
              }))}
            />
          </Form.Item>
          <Form.Item label="车型信息" name="carType" rules={[{ required: true, message: '请选择车型信息' }]}>
            <Select
              showSearch
              placeholder="请选择车型信息"
              options={vehicleOptions
                .filter((item) => (selectedPlate ? item.plate === selectedPlate : true))
                .map((item) => ({
                  value: item.carType,
                  label: item.carType,
                }))}
            />
          </Form.Item>
          <Form.Item label="司机姓名" name="driverName" rules={[{ required: true, message: '请输入司机姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="司机电话" name="driverPhone" rules={[{ required: true, message: '请输入司机电话' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="经办人" name="operatorName" rules={[{ required: true, message: '请输入经办人' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="起租日期" name="startDate" rules={[{ required: true, message: '请选择起租日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="到期日期" name="endDate" rules={[{ required: true, message: '请选择到期日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="押金" name="deposit" rules={[{ required: true, message: '请输入押金' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="租金" name="rent" rules={[{ required: true, message: '请输入租金' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={isDeleteModalVisible}
        onOk={handleDeleteOk}
        onCancel={handleDeleteCancel}
        okText="确认"
        cancelText="取消"
      >
        <p>确定要删除该条数据吗？</p>
      </Modal>
    </div>
  );
};

export default RentalOrderManagement;
// ...existing code...
