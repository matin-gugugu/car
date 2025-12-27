import React, { useEffect, useState } from "react";
import { Button, Form, Input, Table, Modal, message, DatePicker, Tag, Select, Popover } from "antd";
import dayjs from "dayjs";
import http from "../../api/axios";
import "./vehicleManagement.css";

const VehicleManagement = () => {
  const [query, setQuery] = useState({
    plate: "",
    carType: "",
    isRented: "",
  });
  const [tableData, setTableData] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState("edit");
  const [editForm] = Form.useForm();
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [remarkEditingId, setRemarkEditingId] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState("");

  const columns = [
    { title: "车牌号", dataIndex: "plate", key: "plate", align: "center" },
    { title: "车型", dataIndex: "carType", key: "carType", align: "center" },
    { title: "末次年检", dataIndex: "lastInspection", key: "lastInspection", align: "center" },
    { title: "末次保险", dataIndex: "lastInsurance", key: "lastInsurance", align: "center" },
    {
      title: "是否已出租",
      dataIndex: "isRented",
      key: "isRented",
      align: "center",
      render: (val) => (val ? <Tag color="processing">已出租</Tag> : <Tag color="success">未出租</Tag>),
    },
    {
      title: "操作",
      key: "action",
      align: "center",
      render: (_, row) => (
        <div className="vehicle-actions">
          <Button type="link" onClick={() => openEditModal(row)}>编辑</Button>
          <Button type="link" danger onClick={() => showDeleteModal(row.id)}>删除</Button>
        </div>
      ),
    },
    {
      title: "车况备注",
      dataIndex: "conditionRemark",
      key: "conditionRemark",
      align: "center",
      render: (_, row) => (
        <Popover
          trigger="click"
          open={remarkEditingId === row.id}
          onOpenChange={async (open) => {
            if (open) {
              setRemarkEditingId(row.id);
              setRemarkDraft(row.conditionRemark || "");
              return;
            }
            if (remarkEditingId !== row.id) return;
            const nextRemark = (remarkDraft || "").trim();
            const prevRemark = row.conditionRemark || "";
            setRemarkEditingId(null);
            if (nextRemark === prevRemark) return;
            try {
              await http.request({
                url: `/vehicles/${row.id}`,
                method: "put",
                data: { conditionRemark: nextRemark },
              });
              setTableData((prev) =>
                prev.map((item) =>
                  item.id === row.id ? { ...item, conditionRemark: nextRemark } : item
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
              color: row.conditionRemark ? "inherit" : "#999",
            }}
          >
            {row.conditionRemark || "点击填写"}
          </div>
        </Popover>
      ),
    },
  ];

  const getTableData = async (params = {}) => {
    try {
      const res = await http.request({
        url: "/vehicles",
        method: "get",
        params,
      });
      setTableData(res.list || []);
    } catch (e) {
      console.error("获取车辆列表失败:", e);
    }
  };

  const handleFinish = (values) => {
    const payload = {
      plate: values.plate || "",
      carType: values.carType || "",
      isRented: values.isRented ?? "",
    };
    setQuery(payload);
    getTableData(payload);
  };

  const openEditModal = (row) => {
    setModalMode("edit");
    setEditingRow(row);
    setIsEditModalVisible(true);
    editForm.setFieldsValue({
      ...row,
      lastInspection: row.lastInspection ? dayjs(row.lastInspection) : null,
      lastInsurance: row.lastInsurance ? dayjs(row.lastInsurance) : null,
      isRented: row.isRented ? 1 : 0,
    });
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingRow(null);
    setIsEditModalVisible(true);
    editForm.resetFields();
  };

  const handleEditOk = () => {
    editForm.validateFields().then(async (values) => {
      const payload = {
        ...values,
        lastInspection: values.lastInspection ? values.lastInspection.format("YYYY-MM-DD") : "",
        lastInsurance: values.lastInsurance ? values.lastInsurance.format("YYYY-MM-DD") : "",
        isRented: values.isRented ?? 0,
      };
      try {
        if (modalMode === "add") {
          await http.request({
            url: "/vehicles",
            method: "post",
            data: payload,
          });
          message.success("新增成功");
        } else {
          await http.request({
            url: `/vehicles/${editingRow.id}`,
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

  const showDeleteModal = (id) => {
    setDeleteId(id);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteOk = () => {
    http
      .request({
        url: `/vehicles/${deleteId}`,
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
          <Form.Item name="carType">
            <Input placeholder="请输入车型" />
          </Form.Item>
          <Form.Item name="isRented">
            <Select placeholder="是否已出租" allowClear style={{ width: 140 }}>
              <Select.Option value={1}>已出租</Select.Option>
              <Select.Option value={0}>未出租</Select.Option>
            </Select>
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
        title={modalMode === "add" ? "新增车辆" : "编辑车辆"}
        open={isEditModalVisible}
        onOk={handleEditOk}
        onCancel={handleEditCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" initialValues={{ isRented: 0 }}>
          <Form.Item label="车牌号" name="plate" rules={[{ required: true, message: "请输入车牌号" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="车型" name="carType" rules={[{ required: true, message: "请输入车型" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="末次年检" name="lastInspection">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="末次保险" name="lastInsurance">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="是否已出租" name="isRented">
            <Select>
              <Select.Option value={1}>已出租</Select.Option>
              <Select.Option value={0}>未出租</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="车况备注" name="conditionRemark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

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
