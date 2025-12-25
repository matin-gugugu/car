import axios from "axios";

// 开发（npm start）：使用 CRA 代理 -> 只写相对路径 '/api'
// 生产（npm run build）：从环境变量读取真实后端地址（可选）
const DEV_BASE = "/api";
const PROD_BASE =
  process.env.REACT_APP_API_BASE_URL || "/api"; // 同域+Nginx 反代时仍可用 '/api'

const baseUrl =
  process.env.NODE_ENV === "production" ? PROD_BASE : DEV_BASE;

// axios 二次封装
class HttpRequest {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getInsideConfig() {
    return {
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
      // 如果需要携带 cookie：
      // withCredentials: true,
    };
  }

  interception(instance) {
    // 请求拦截
    instance.interceptors.request.use(
      (config) => {
        // 例如附加 token
        // const token = localStorage.getItem("token");
        // if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截
    instance.interceptors.response.use(
      (response) => {
        // 统一返回 data，调用方更简洁
        return response.data;
      },
      (error) => {
        // 这里可统一弹错/上报
        // console.error("API error:", error?.response || error.message);
        return Promise.reject(error);
      }
    );
  }

  request(options) {
    const instance = axios.create(this.getInsideConfig()); // 用默认配置创建实例
    this.interception(instance);
    return instance(options); // options 里再传 url/method/data/params 等
  }
}

export default new HttpRequest(baseUrl);
