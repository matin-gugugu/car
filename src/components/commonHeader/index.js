import React from "react";
import { Button, Layout, Avatar, Dropdown} from 'antd';
import './index.css'
import { MenuUnfoldOutlined } from '@ant-design/icons';
import {useDispatch} from 'react-redux'
import {collapseMenu} from '../../store/reducers/tab'

const { Header} = Layout;

const CommonHeader = ({collapsed}) => {

  const logout = () => {
  }
  const items = [
      {
        key: '1',
        label: (
          <a target="_blank" rel="noopener noreferrer" >
            个人中心
          </a>
        ),
      },
      {
        key: '2',
        label: (
          <a onClick={() => logout} target="_blank" rel="noopener noreferrer" >
            退出
          </a>
        )
      }
    ];
    // 获取redux中的dispatch方法
      const dispatch = useDispatch()
    // 点击展开收起按钮
    const setCollapse = () => {
      console.log(collapsed, "CommonHeader");
      dispatch(collapseMenu())
    }
  return (
    <Header className = "header-container">
            <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                // icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                // onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 32,
                  height: 32,
                  backgroundColor: 'white'
                }}
                onClick={() => setCollapse()}
            />
            <Dropdown menu={{ items }}>
              <Avatar
                size={50}
                className="header-avatar"
                src={<img src={require("../../assets/user.jpg")} />}
              />
            </Dropdown>
            

    </Header>
  );
};
export default CommonHeader;
