import React, {useEffect, useState} from "react";
import { Button, Form, Input, Table} from "antd";
import './userManagement.css'
import { getUser } from  '../../api'
import { render } from "@testing-library/react";



const UserManagement = () => {

  const [listData, setListData] = useState({
    keyword: '',
  })

  const [tableData, setTableData] = useState([])

  // 新增
    const handleClick = (type, rowData) => { 
        if (type === 'add') {
            console.log('新增')
        }
        if (type === 'edit') {
            console.log('编辑')
        }
        
    };

    const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '年龄', dataIndex: 'age', key: 'age' },
    { title: '性别', dataIndex: 'sex', key: 'sex' , render: (val) =>val ? '女' : '男'},
    { title: '出生日期', dataIndex: 'birth', key: 'birth' },
    { title: '地址', dataIndex: 'addr', key: 'addr' },
    { title: '操作', render: (rowData) => {
        return (
          <div className="flex-box">
            <Button style={{ marginRight: '5px' }} onClick={() => handleClick('edit')}>编辑</Button>
            <Button>删除</Button>
          </div>
        )
          

    } },
    ]

  // 获取列表数据
    const getTableData = () => {
      console.log('获取列表数据')
      getUser(listData).then((res)=>{
        console.log(res,"res")
        setTableData(res.list || [])
      })
    }

    // 提交
    const handleFinish = (e) =>{
      const keyword = e.keyword || ''
      setListData({
        keyword,
      })
      getTableData()
      console.log(e)
    }

    useEffect(() => {
        // 调用后端接口，获取列表数据
      getTableData()
      }, [])
    

    return (
      <div className="user">
         <div className="flex-box space-between">
            <Button type="primary" onClick={() => handleClick('add', listData)}>新增</Button>
            <Form
              layout="inline"
              onFinish={handleFinish}>
                <Form.Item name = "keyword">
                  <Input placeholder="请输入用户名" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">查询</Button>
                </Form.Item>

            </Form>

         </div>
         <Table
            columns={columns}
            dataSource={tableData}
            rowKey="id"
            pagination={false}
        />
      </div>
    );
  };
  export default UserManagement;
