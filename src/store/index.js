import {configureStore} from '@reduxjs/toolkit'
import TabReducer from './reducers/tab'
const store = configureStore({
  reducer: {
    tab: TabReducer
  } 
})

export default store
