import Detective from '../components/Detective';
import { getDiscoveryCoverage } from '../lib/server/replay';
export default function Page() { return <Detective coverage={getDiscoveryCoverage()} />; }
