import { useParams } from "react-router";
import { UserDirectory } from "~/components/UserDirectory";
export default function SalonCustomers() {
  const { salonId } = useParams();
  return <UserDirectory customers salonId={salonId} />;
}
