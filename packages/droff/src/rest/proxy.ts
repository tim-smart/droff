import { AxiosInstance, Method } from "axios";
import * as Http from "http";

export const createHandler =
  (client: Pick<AxiosInstance, "request">): Http.RequestListener =>
  (req, res) => {
    client
      .request({
        method: req.method as Method,
        url: req.url,
        data: req,
        responseType: "stream",
      })
      .then((r) => r.data.pipe(res));
  };
