import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Table, Modal, message, DatePicker, Popover, Select, Tag } from "antd";
import dayjs from "dayjs";
import http from "../../api/axios";  
import "./rentalOrderManagement.css";
const RentalOrderManagement = () => {
  const [query, setQuery] = useState({
    plate: '',
    driverName: '',
    operatorName: '',
  });

  const [tableData, setTableData] = useState([]);
  const [editingRow, setEditingRow] = useState(null); // 编辑行数据
  const [isEditModalVisible, setIsEditModalVisible] = useState(false); // 编辑弹窗
  const [modalMode, setModalMode] = useState("edit"); // edit | add
  const [editForm] = Form.useForm();
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);
  const [settleRow, setSettleRow] = useState(null);
  const [remarkEditingId, setRemarkEditingId] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState("");

  // 删除弹窗相关
  const [deleteId, setDeleteId] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const columns = [
    {
      title: '车牌号',
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
      title: '车型信息',
      dataIndex: 'carType',
      key: 'carType',
      align: 'center',
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      key: 'driverName',
      align: 'center',
    },
    { title: '司机电话', dataIndex: 'driverPhone', key: 'driverPhone', align: 'center' },
    { title: '经办人', dataIndex: 'operatorName', key: 'operatorName', align: 'center' },
    {
      title: '收租日期',
      dataIndex: 'rentDueDate',
      key: 'rentDueDate',
      align: 'center',
    },
    { title: '押金', dataIndex: 'deposit', key: 'deposit', align: 'center' },
    { title: '租金', dataIndex: 'rent', key: 'rent', align: 'center' },
    {
      title: '收租状态',
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
          <Button type="link" className="action-btn" danger onClick={() => showDeleteModal(row)}>删除</Button>
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

  const handleSettle = (row) => {
    if (row.rentRecordStatus === 'settled') {
      message.info("该收租记录已结清");
      return;
    }
    setSettleRow(row);
    setIsSettleModalVisible(true);
  };

  const settleOrder = async (row) => {
    await http.request({
      url: `/rent-records/${row.rentRecordId}`,
      method: "put",
      data: { status: "settled" },
    });
  };

  const handleRenew = async () => {
    if (!settleRow) return;
    try {
      await http.request({
        url: "/rental-orders",
        method: "post",
        data: {
          plate: settleRow.plate,
          carType: settleRow.carType,
          driverName: settleRow.driverName,
          driverPhone: settleRow.driverPhone,
          operatorName: settleRow.operatorName || "",
          startDate: "",
          endDate: "",
          deposit: "",
          rent: "",
        },
      });
      await settleOrder(settleRow);
      message.success("已续租并结算当前租期");
      setIsSettleModalVisible(false);
      setSettleRow(null);
      getTableData(query);
    } catch (e) {
      console.error("续租失败:", e);
      message.error("续租失败");
    }
  };

  const handleNoRenew = async () => {
    if (!settleRow) return;
    try {
      await settleOrder(settleRow);
      message.success("已结算");
      setIsSettleModalVisible(false);
      setSettleRow(null);
      getTableData(query);
    } catch (e) {
      console.error("结算失败:", e);
      message.error("结算失败");
    }
  };

  const handleCloseSettleModal = () => {
    setIsSettleModalVisible(false);
    setSettleRow(null);
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
  const getTableData = async (params = {}) => {
    try {
      const res = await http.request({
        url: "/rent-records",
        method: "get",
        params,
      });
      const hasUnsettled = (row) => {
        return row.rentRecordStatus !== "settled";
      };

      const sorted = (res.list || []).slice().sort((a, b) => {
        const plateCompare = (a.plate || "").localeCompare(b.plate || "");
        if (plateCompare !== 0) return plateCompare;

        const carTypeCompare = (a.carType || "").localeCompare(b.carType || "");
        if (carTypeCompare !== 0) return carTypeCompare;

        const statusA = hasUnsettled(a) ? 0 : 1;
        const statusB = hasUnsettled(b) ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;

        const dueA = dayjs(a.rentDueDate || 0).valueOf();
        const dueB = dayjs(b.rentDueDate || 0).valueOf();
        return dueB - dueA;
      });
      setTableData(sorted);
    } catch (e) {
      console.error("获取收租记录失败:", e);
    }
  };

  // 查询表单提交
  const handleFinish = async (values)  => {
    setQuery(values);
    getTableData(values);
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
          await http.request({
            url: `/rental-orders/${editingRow.orderId}`,
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
  const showDeleteModal = (row) => {
    setDeleteId(row.rentRecordId);
    setDeleteRow(row);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteOk = () => {
    http
      .request({
        url: `/rent-records/${deleteId}`,
        method: "delete",
      })
      .then((res) => {
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
  };

  useEffect(() => {
    getTableData();
    loadVehicles();
  }, []);

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
        <Form layout="inline" onFinish={handleFinish} style={{ flex: 1 }}>
          <Form.Item name="plate">
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="driverName">
            <Input placeholder="请输入司机姓名" />
          </Form.Item>
          <Form.Item name="operatorName">
            <Input placeholder="请输入经办人" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">查询</Button>
          </Form.Item>
        </Form>
        <Button type="primary" onClick={openAddModal}>新增</Button>
      </div>
      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="rentRecordId"
        pagination={false}
        rowClassName={(record) =>
          plateShadeMap.get(record.plate || "") === 1 ? "plate-shade-row" : ""
        }
      />

      <Modal
        title="是否续租"
        open={isSettleModalVisible}
        onCancel={handleCloseSettleModal}
        footer={[
          <Button key="cancel" onClick={handleCloseSettleModal}>取消</Button>,
          <Button key="no" onClick={handleNoRenew}>否</Button>,
          <Button key="yes" type="primary" onClick={handleRenew}>是</Button>,
        ]}
      >
        确认是否续租？
      </Modal>

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
