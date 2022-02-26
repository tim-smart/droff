import { AxiosInstance, AxiosResponse, Method } from "axios";
import * as Http from "http";

export const createHandler =
  (client: Pick<AxiosInstance, "request">): Http.RequestListener =>
  (req, res) =>
    client
      .request({
        method: req.method as Method,
        url: req.url,
        data: req,
        responseType: "stream",
      })
      .then(handleResponse(res))
      .catch(() => {
        res.writeHead(500);
        res.end();
      });

const handleResponse = (res: Http.ServerResponse) => (r: AxiosResponse) => {
  const headers = r.headers;
  delete headers["date"];
  delete headers["connection"];
  delete headers["keep-alive"];
  delete headers["transfer-encoding"];

  res.writeHead(r.status, headers);
  return r.data.pipe(res);
};
