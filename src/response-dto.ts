export class ResponseDto<TData> {
  message: string;

  statusCode: number;

  data: TData;
}
