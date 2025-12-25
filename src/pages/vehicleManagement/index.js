import React, { useEffect, useState } from "react";
import { Button, Form, Input, Table, Modal, message, DatePicker, Tag, Popover } from "antd";
import dayjs from "dayjs";
import http from "../../api/axios";  
const VehicleManagement = () => {
  const [query, setQuery] = useState({
    plate: '',
    driverName: ''
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

  // 删除弹窗相关
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const columns = [
    { title: '车牌号', dataIndex: 'plate', key: 'plate', align: 'center' },
    {
      title: '车型信息',
      dataIndex: 'carType',
      key: 'carType',
      align: 'center',
      sorter: (a, b) => (a.carType || '').localeCompare(b.carType || ''),
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      key: 'driverName',
      align: 'center',
      sorter: (a, b) => (a.driverName || '').localeCompare(b.driverName || ''),
    },
    { title: '司机电话', dataIndex: 'driverPhone', key: 'driverPhone', align: 'center' },
    {
      title: '起租日期',
      dataIndex: 'startDate',
      key: 'startDate',
      align: 'center',
      sorter: (a, b) =>
        dayjs(a.startDate || 0).valueOf() - dayjs(b.startDate || 0).valueOf(),
    },
    {
      title: '到期日期',
      dataIndex: 'endDate',
      key: 'endDate',
      align: 'center',
      sorter: (a, b) =>
        dayjs(a.endDate || 0).valueOf() - dayjs(b.endDate || 0).valueOf(),
    },
    { title: '押金', dataIndex: 'deposit', key: 'deposit', align: 'center' },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
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
        <div>
          <Button type="link" onClick={() => handleSettle(row)}>结算</Button>
          <Button type="link" onClick={() => openEditModal(row)}>编辑</Button>
          <Button type="link" danger onClick={() => showDeleteModal(row.id)}>删除</Button>
        </div>
      )
    }
    ,
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      align: 'center',
      render: (_, row) => (
        <Popover
          trigger="click"
          open={remarkEditingId === row.id}
          onOpenChange={async (open) => {
            if (open) {
              setRemarkEditingId(row.id);
              setRemarkDraft(row.remark || "");
              return;
            }
            if (remarkEditingId !== row.id) return;
            const nextRemark = (remarkDraft || "").trim();
            const prevRemark = row.remark || "";
            setRemarkEditingId(null);
            if (nextRemark === prevRemark) return;
            try {
              await http.request({
                url: `/rental-orders/${row.id}`,
                method: "put",
                data: { remark: nextRemark },
              });
              setTableData((prev) =>
                prev.map((item) =>
                  item.id === row.id ? { ...item, remark: nextRemark } : item
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
              maxWidth: 120,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
              color: row.remark ? "inherit" : "#999",
            }}
            title={row.remark || ""}
          >
            {row.remark || "点击填写"}
          </div>
        </Popover>
      ),
    },
  ];

  const handleSettle = (row) => {
    if (row.status === 'settled') {
      message.info("该订单已结算");
      return;
    }
    setSettleRow(row);
    setIsSettleModalVisible(true);
  };

  const settleOrder = async (rowId) => {
    await http.request({
      url: `/rental-orders/${rowId}`,
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
          startDate: "",
          endDate: "",
          deposit: "",
          status: "unsettled",
        },
      });
      await settleOrder(settleRow.id);
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
      await settleOrder(settleRow.id);
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

  // 获取列表数据
  const getTableData = async (params = {}) => {
    try {
      const res = await http.request({
        url: "/rental-orders",
        method: "get",
        params,
      });
      setTableData(res.list || []);
    } catch (e) {
      console.error("获取车辆列表失败:", e);
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
            url: `/rental-orders/${editingRow.id}`,
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
  const showDeleteModal = (id) => {
    setDeleteId(id);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteOk = () => {
    http
      .request({
        url: `/rental-orders/${deleteId}`,
        method: "delete",
      })
      .then(() => {
        setIsDeleteModalVisible(false);
        message.success("删除成功");
        getTableData(query);
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
  }, []);

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
          <Form.Item>
            <Button type="primary" htmlType="submit">查询</Button>
          </Form.Item>
        </Form>
        <Button type="primary" onClick={openAddModal}>新增</Button>
      </div>
      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="id"
        pagination={false}
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
          <Form.Item label="车牌号" name="plate" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="车型信息" name="carType" rules={[{ required: true, message: '请输入车型信息' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="司机姓名" name="driverName" rules={[{ required: true, message: '请输入司机姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="司机电话" name="driverPhone" rules={[{ required: true, message: '请输入司机电话' }]}>
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

export default VehicleManagement;
// ...existing code...
