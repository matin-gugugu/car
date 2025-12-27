import { Children, Component } from 'react'
import {createBrowserRouter, Navigate} from  'react-router-dom'
import Main from '../pages/main'
import Home from '../pages/home'
import userManagement from '../pages/userManagement'
import RentalOrderManagement from '../pages/rentalOrderManagement'
import VehicleManagement from '../pages/vehicleManagement'

//通过createBrowserRouter函数配置路由器
const routes = [
    {
        path: '/',
        Component: Main,
        children: [
            {
                path: '/',
                element: <Navigate to='/home' replace/>
            },
            {   
                path: 'home',
                Component: Home,
            },
            {
                path: 'rental-orders',
                Component: RentalOrderManagement,
            },
            {
                path: 'vehicles',
                Component: VehicleManagement,
            },
            {
                path: 'userManagement',
                Component: userManagement,
            }
        ]
           
        
    }
]
export default createBrowserRouter(routes)
