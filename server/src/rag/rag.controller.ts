import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { RagService, type UploadFile } from "./rag.service";

@Controller("documents")
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get()
  list() {
    return this.rag.listSources();
  }

  @Post("upload")
  @UseInterceptors(FilesInterceptor("files", 20))
  upload(@UploadedFiles() files: UploadFile[]) {
    return this.rag.ingest(files ?? []);
  }

  @Delete(":source")
  remove(@Param("source") source: string) {
    return this.rag.removeSource(decodeURIComponent(source));
  }
}
