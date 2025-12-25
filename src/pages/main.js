import React, {useState} from "react";
import { Outlet } from "react-router-dom";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, theme } from 'antd';
import CommonAside from "../components/commonAside";
import CommonHeader from "../components/commonHeader";
import {useSelector} from 'react-redux'
const { Header, Sider, Content } = Layout;


const Main = () => {
  // const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  // 获取展开收起的状态
  const collapsed = useSelector(state => state.tab.isCollapse)
  return (
    <Layout className="main-container">
      {/* <Sider trigger={null} collapsible collapsed={collapsed}>
        <h3 className="app-name">车辆管理系统</h3>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={[
            {
              key: '1',
              icon: <UserOutlined />,
              label: '首页',
              router: '/home'
            },
            {
              key: '2',
              icon: <VideoCameraOutlined />,
              label: '车辆管理',
              router: '/vehicleManagement'
            },
            {
              key: '3',
              icon: <UploadOutlined />,
              label: '司机管理',
            },
          ]}
          style={{
            height : '100%',
          }

          }
        />
      </Sider> */}
      <CommonAside collapsed = {collapsed}/>
      
      <Layout>
        {/* <Header style={{ padding: 0, background: colorBgContainer }}>
          <Button
            type="text"
            // icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            // onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
        </Header> */
        }
        <CommonHeader collapsed = {collapsed}/>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />  
        </Content>
      </Layout>
    </Layout>
  );
};
export default Main;