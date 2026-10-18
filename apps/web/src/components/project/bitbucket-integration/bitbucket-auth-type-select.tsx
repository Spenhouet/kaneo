import { useTranslation } from "react-i18next";
import type { BitbucketAuthType } from "@/components/project/bitbucket-integration/bitbucket-access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BitbucketAuthTypeSelectProps = {
  id?: string;
  value: BitbucketAuthType;
  disabled?: boolean;
  onChange: (value: BitbucketAuthType) => void;
};

export function BitbucketAuthTypeSelect({
  id,
  value,
  disabled = false,
  onChange,
}: BitbucketAuthTypeSelectProps) {
  const { t } = useTranslation();
  const label = (type: BitbucketAuthType) =>
    type === "access_token"
      ? t("settings:bitbucketIntegration.authTypeAccessToken")
      : t("settings:bitbucketIntegration.authTypeApiToken");

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === "api_token" || next === "access_token") onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-label={t("settings:bitbucketIntegration.authTypeLabel")}
      >
        <SelectValue>{label(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="api_token">{label("api_token")}</SelectItem>
        <SelectItem value="access_token">{label("access_token")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
