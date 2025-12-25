import React from 'react';
import MenuConfig from '../../config';
import * as Icon from '@ant-design/icons';
import { Button, Layout, Menu, theme } from 'antd';
import {useNavigate} from 'react-router-dom'


const { Header, Sider, Content } = Layout;

const iconToElement = (name) => React.createElement(Icon[name])
// 处理菜单数据
const items = MenuConfig.map((icon) => {
    const child = {
        key : icon.path,
        icon : iconToElement(icon.icon),
        label : icon.label
    }
    return child
})


const CommonAside = ({collapsed}) => {
    console.log(collapsed, "CommonAside");
    const navigate = useNavigate();
    const selectMenu = (e) => {
        navigate(e.key)
    }
    return (
        <Sider trigger={null} collapsed={collapsed}>
            <h3 className="app-name"> {collapsed? '首约' : '首约车管系统'}</h3>
            <Menu
                theme="dark"
                mode="inline"
                defaultSelectedKeys={['1']}
                items={items}
                style={{
                    height: '100%',
                }}
                onClick = {selectMenu}


            />
        </Sider>
    )
}
export default CommonAside;