import CertificatesView from "@/src/components/certificates/CertificatesView";
import { GenericMetrologyLabels } from "@/src/components/certificates/GenericMetrologyLabels";

export default function CertificadosPage() {
  return (
    <>
      <GenericMetrologyLabels />
      <CertificatesView />
    </>
  );
}
