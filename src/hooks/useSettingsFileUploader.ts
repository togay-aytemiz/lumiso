import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";

type UploadResult = { success?: boolean; error?: unknown };

type UseSettingsFileUploaderOptions<TResult = unknown> = {
  upload: (file: File) => Promise<TResult | UploadResult | void>;
  inputRef?: RefObject<HTMLInputElement>;
  accept?: string[];
  maxSizeMB?: number;
  autoResetInput?: boolean;
  generatePreview?: boolean;
  onSuccess?: (result: TResult | UploadResult | void, file: File) => void;
  onError?: (error: Error) => void;
  onValidationError?: (message: string) => void;
};

type UseSettingsFileUploaderReturn = {
  isUploading: boolean;
  error: string | null;
  previewUrl: string | null;
  inputProps: {
    accept: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  };
  openFilePicker: () => void;
  clearError: () => void;
};

const DEFAULT_ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function useSettingsFileUploader<TResult = unknown>({
  upload,
  inputRef,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 2,
  autoResetInput = true,
  generatePreview = false,
  onSuccess,
  onError,
  onValidationError,
}: UseSettingsFileUploaderOptions<TResult>): UseSettingsFileUploaderReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const acceptAttr = useMemo(() => accept.join(","), [accept]);

  const matchesMimeType = useCallback(
    (file: File) => {
      if (!accept.length) return true;
      return accept.some((type) => {
        if (type === "*/*" || type === "*") return true;
        if (type.endsWith("/*")) {
          const prefix = type.slice(0, -1);
          return file.type.startsWith(prefix);
        }
        return file.type === type;
      });
    },
    [accept]
  );

  const resetInput = useCallback(() => {
    if (inputRef?.current) {
      inputRef.current.value = "";
    }
  }, [inputRef]);

  const handleValidationError = useCallback(
    (message: string) => {
      setError(message);
      onValidationError?.(message);
    },
    [onValidationError]
  );

  const processUpload = useCallback(
    async (file: File) => {
      setError(null);

      if (!matchesMimeType(file)) {
        handleValidationError("Unsupported file type. Please choose a compatible image.");
        resetInput();
        return;
      }

      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        handleValidationError(`File is too large. Maximum size is ${maxSizeMB} MB.`);
        resetInput();
        return;
      }

      if (generatePreview) {
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return URL.createObjectURL(file);
        });
      }

      setIsUploading(true);
      try {
        const result = await upload(file);
        if (
          result &&
          typeof result === "object" &&
          "success" in result &&
          result.success === false
        ) {
          const uploadError =
            result.error instanceof Error
              ? result.error
              : new Error("Upload failed");
          throw uploadError;
        }
        onSuccess?.(result, file);
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error("Failed to upload file");
        setError(normalizedError.message);
        onError?.(normalizedError);
        if (generatePreview) {
          setPreviewUrl((previous) => {
            if (previous) {
              URL.revokeObjectURL(previous);
            }
            return null;
          });
        }
      } finally {
        setIsUploading(false);
        if (autoResetInput) {
          resetInput();
        }
      }
    },
    [
      autoResetInput,
      generatePreview,
      handleValidationError,
      matchesMimeType,
      maxSizeMB,
      onError,
      onSuccess,
      resetInput,
      upload,
    ]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void processUpload(file);
    },
    [processUpload]
  );

  const openFilePicker = useCallback(() => {
    inputRef?.current?.click();
  }, [inputRef]);

  return {
    isUploading,
    error,
    previewUrl,
    clearError: () => setError(null),
    inputProps: {
      accept: acceptAttr,
      onChange: handleInputChange,
    },
    openFilePicker,
  };
}
