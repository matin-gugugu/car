import React, {useEffect, useState} from "react";
import { Col, Card, Row, Table } from 'antd';
import './home.css'
import {getData} from '../../api'

// table列的数据
const columns = [
  {
    title: '车型',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '今日租出',
    dataIndex: 'todayRent',
    key: 'todayRent',
  },
  {
    title: '本月租出',
    dataIndex: 'monthRent',
    key: 'monthRent',
  },
  {
    title: '总租出',
    dataIndex: 'totalRent',
  }
]

const Home = () => {
  const userImg = require("../../assets/images/user.jpg")
  useEffect(() => {
    getData().then((res) => { 
      console.log(res, 'res') 
      const { tableData } = res?.data || {}
      setTableData(tableData || [])
    }) 
  }, [])

  // 定义Table数据
  const [tableData, setTableData] = useState([])

  return (
      <Row className = "home">
        <Col span={10}>
          <Card hoverable>
            <div className="user">
              <img src = {userImg}/>
              <div className="userinfo">
                <p className = "name">Admin</p>
                <p className = "access">超级管理员</p>
              </div>
              
            </div>
            <div className="login-info">
                <p>上次登录时间：<span></span>2025-06-20 10:00</p>
                <p>上次登录地点：<span></span>吉林长春</p>
            </div>
          </Card>
          <Card hoverable>
            <Table rowKey={"name"} dataSource={tableData} columns={columns} pagination={false} />

            
          </Card>
        </Col>
        <Col span={16}>
        </Col>
      </Row>
    );
  };
  export default Home;
